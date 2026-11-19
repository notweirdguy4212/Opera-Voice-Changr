"""Voice preset definitions and user preset persistence.

A preset bundles the tunable stream settings (pitch, formant, effect rack
state) into one named payload the client can apply in a single click.
Built-in presets ship with the app; user presets are stored as JSON on disk.
"""

import json
import logging
import re
import threading
from pathlib import Path

from backend.services.preset_settings import normalize_preset_settings

logger = logging.getLogger(__name__)

MAX_USER_PRESETS = 100

BUILTIN_PRESETS = [
    {
        "id": "clean",
        "name": "Clean",
        "emoji": "🎙️",
        "description": "No coloration — raw model or mic output",
        "settings": {"pitch_shift": 0, "formant_shift": 0, "effects": {}},
    },
    {
        "id": "chipmunk",
        "name": "Chipmunk",
        "emoji": "🐿️",
        "description": "High pitch, bright formants",
        "settings": {
            "pitch_shift": 7,
            "formant_shift": 4,
            "effects": {},
        },
    },
    {
        "id": "helium",
        "name": "Helium",
        "emoji": "🎈",
        "description": "Balloon-gas timbre, mostly formants",
        "settings": {
            "pitch_shift": 3,
            "formant_shift": 7,
            "effects": {},
        },
    },
    {
        "id": "deep",
        "name": "Deep Voice",
        "emoji": "🎩",
        "description": "Lowered pitch with darker formants",
        "settings": {
            "pitch_shift": -6,
            "formant_shift": -4,
            "effects": {"eq": {"enabled": True, "low": 4, "high": -2}},
        },
    },
    {
        "id": "monster",
        "name": "Monster",
        "emoji": "👹",
        "description": "Growling low pitch with drive",
        "settings": {
            "pitch_shift": -9,
            "formant_shift": -5,
            "effects": {
                "distortion": {"enabled": True, "drive": 0.45},
                "reverb": {"enabled": True, "size": 0.35, "mix": 0.25},
            },
        },
    },
    {
        "id": "robot",
        "name": "Robot",
        "emoji": "🤖",
        "description": "Ring-mod metal voice with bit reduction",
        "settings": {
            "pitch_shift": 0,
            "formant_shift": 0,
            "effects": {
                "robot": {"enabled": True, "freq": 90},
                "bitcrush": {"enabled": True, "bits": 10, "down": 2},
            },
        },
    },
    {
        "id": "alien",
        "name": "Alien",
        "emoji": "👽",
        "description": "Slow ring-mod wobble with chorus",
        "settings": {
            "pitch_shift": 2,
            "formant_shift": 2,
            "effects": {
                "robot": {"enabled": True, "freq": 28},
                "chorus": {"enabled": True, "rate": 1.6, "depth": 0.7, "mix": 0.5},
            },
        },
    },
    {
        "id": "whisper",
        "name": "Whisper",
        "emoji": "🤫",
        "description": "Breathy noise-excited voice",
        "settings": {
            "pitch_shift": 0,
            "formant_shift": 0,
            "effects": {
                "whisper": {"enabled": True, "mix": 0.85},
                "gain": {"enabled": True, "db": 4},
            },
        },
    },
    {
        "id": "ghost",
        "name": "Ghost",
        "emoji": "👻",
        "description": "Whispery echoes in a large space",
        "settings": {
            "pitch_shift": -2,
            "formant_shift": 0,
            "effects": {
                "whisper": {"enabled": True, "mix": 0.6},
                "reverb": {"enabled": True, "size": 0.85, "mix": 0.5},
                "echo": {"enabled": True, "time": 0.42, "feedback": 0.45, "mix": 0.3},
            },
        },
    },
    {
        "id": "telephone",
        "name": "Telephone",
        "emoji": "📞",
        "description": "Narrowband landline call",
        "settings": {
            "pitch_shift": 0,
            "formant_shift": 0,
            "effects": {
                "telephone": {"enabled": True},
                "compressor": {"enabled": True, "threshold": -24, "ratio": 4},
            },
        },
    },
    {
        "id": "megaphone",
        "name": "Megaphone",
        "emoji": "📣",
        "description": "Distorted PA horn",
        "settings": {
            "pitch_shift": 0,
            "formant_shift": 0,
            "effects": {
                "telephone": {"enabled": True},
                "distortion": {"enabled": True, "drive": 0.55},
                "gain": {"enabled": True, "db": 3},
            },
        },
    },
    {
        "id": "radio",
        "name": "Radio DJ",
        "emoji": "📻",
        "description": "Broadcast warmth and compression",
        "settings": {
            "pitch_shift": 0,
            "formant_shift": 0,
            "effects": {
                "eq": {"enabled": True, "low": 3, "high": 2},
                "compressor": {"enabled": True, "threshold": -26, "ratio": 5},
                "gain": {"enabled": True, "db": 2},
            },
        },
    },
    {
        "id": "cave",
        "name": "Cave",
        "emoji": "🕳️",
        "description": "Long dark echoes",
        "settings": {
            "pitch_shift": 0,
            "formant_shift": 0,
            "effects": {
                "reverb": {"enabled": True, "size": 0.85, "mix": 0.45},
                "echo": {"enabled": True, "time": 0.35, "feedback": 0.5, "mix": 0.35},
                "eq": {"enabled": True, "low": 2, "high": -4},
            },
        },
    },
    {
        "id": "stadium",
        "name": "Stadium",
        "emoji": "🏟️",
        "description": "Huge announcement reverb",
        "settings": {
            "pitch_shift": 0,
            "formant_shift": 0,
            "effects": {
                "echo": {"enabled": True, "time": 0.6, "feedback": 0.4, "mix": 0.4},
                "reverb": {"enabled": True, "size": 1.0, "mix": 0.5},
                "compressor": {"enabled": True, "threshold": -20, "ratio": 3},
            },
        },
    },
    {
        "id": "underwater",
        "name": "Underwater",
        "emoji": "🌊",
        "description": "Muffled, slowly wobbling depths",
        "settings": {
            "pitch_shift": 0,
            "formant_shift": -2,
            "effects": {
                "eq": {"enabled": True, "low": 6, "high": -12},
                "chorus": {"enabled": True, "rate": 0.3, "depth": 0.8, "mix": 0.6},
            },
        },
    },
    {
        "id": "arcade",
        "name": "Arcade",
        "emoji": "🕹️",
        "description": "8-bit crushed game cabinet voice",
        "settings": {
            "pitch_shift": 2,
            "formant_shift": 0,
            "effects": {
                "bitcrush": {"enabled": True, "bits": 6, "down": 6},
                "eq": {"enabled": True, "low": -2, "high": 4},
            },
        },
    },
]


def _slugify(name: str) -> str:
    slug = re.sub(r"[^\w\-]+", "-", name.strip().lower()).strip("-")
    return slug[:48] or "preset"


# Large, deterministic processing-preset library. These are parameter recipes,
# not bundled neural voice identities; conversion quality still depends on the
# user's selected compatible voice model.
_PRESET_FAMILIES = [
    {
        "category": "Natural",
        "emoji": "🌿",
        "names": ["Natural Warm", "Natural Clear", "Soft Neutral", "Gentle Alto", "Gentle Baritone", "Conversational", "Close Mic", "Airy Natural", "Warm Speech", "Balanced Speech", "Calm Narrator", "Friendly", "Smooth", "Low Coloration", "Bright Natural", "Rounded", "Intimate", "Open Tone", "Soft Presence", "Studio Neutral", "Natural Low", "Natural Mid", "Natural High", "Subtle Warmth", "Subtle Brightness", "Soft Spoken", "Clear Spoken", "Relaxed", "Focused", "Dry Studio", "Warm Studio", "Clean Presence", "Gentle Resonance", "Light Texture", "Full Texture", "Natural Broadcast", "Natural Podcast", "Natural Stream", "Everyday Voice", "Reference Voice"],
        "pitch": [-1, 0, 1, 0, -0.5], "formant": [-0.5, 0, 0.5],
        "effects": [None, "warm", "clear", "soft"],
    },
    {
        "category": "Deep & Bass",
        "emoji": "🎙️",
        "names": ["Deep Voice", "Deep Warmth", "Dark Baritone", "Bass Narrator", "Low Resonance", "Velvet Bass", "Subtle Bass", "Cinematic Low", "Rich Baritone", "Heavy Baritone", "Low Radio", "Deep Podcast", "Dark Studio", "Rounded Bass", "Chest Tone", "Low Presence", "Warm Bass", "Smooth Bass", "Gravel Lite", "Midnight Narrator", "Deep Calm", "Deep Clear", "Low and Smooth", "Bass Broadcast", "Low Character", "Dark Velvet", "Deep Conversational", "Low Register", "Bass Focus", "Deep Neutral", "Low Texture", "Dark Warmth", "Deep Authority", "Low Softness", "Bass Room", "Deep Intimate", "Low Resonant", "Sub Bass Character", "Deep Stream", "Classic Baritone"],
        "pitch": [-8, -6, -4, -3, -5], "formant": [-5, -4, -3, -2],
        "effects": ["warm", "bass", "broadcast", None],
    },
    {
        "category": "Bright & High",
        "emoji": "✨",
        "names": ["Bright Voice", "Light Tenor", "Clear High", "Youthful Bright", "Airy High", "Sparkle", "Light Neutral", "Bright Narrator", "Soft High", "Crisp High", "Lively", "Light Stream", "Bright Podcast", "Clear Upper", "Shimmer", "Gentle Lift", "Sunny", "Open High", "Silky High", "Light Character", "Bright Presence", "High Warmth", "Clear Light", "Soft Sparkle", "Airy Presence", "Crisp Conversational", "Light Studio", "Bright Studio", "Fresh Tone", "Upper Register", "Light Resonance", "Gentle Treble", "High Clarity", "Soft Tenor", "Bright Broadcast", "Light Radio", "Clear Stream", "Luminous", "Fresh Narrator", "Bright Neutral"],
        "pitch": [2, 3, 4, 5, 1], "formant": [1, 2, 3, 0],
        "effects": ["clear", "sparkle", None, "soft"],
    },
    {
        "category": "Character & Creative",
        "emoji": "🎭",
        "names": ["Storyteller", "Fantasy Hero", "Mystic", "Gentle Giant", "Ancient Sage", "Space Explorer", "Playful", "Cartoon Light", "Cartoon Deep", "Fairy Tale", "Dramatic", "Whisper Echo", "Dreamlike", "Ghostly", "Underwater", "Alien Soft", "Robot Warm", "Vintage Radio", "Telephone", "Megaphone", "Cave Echo", "Stadium Announcer", "Arcade", "Retro Game", "Synthetic", "Hollow", "Metallic", "Chorus Double", "Wide Stereo", "Dream Pop", "Lo-Fi", "Tape Warmth", "Old Cinema", "Trailer Voice", "Fantasy Villain", "Fantasy Guide", "Mysterious", "Enchanted", "Comic", "Animated Narrator"],
        "pitch": [-4, -2, 0, 2, 4], "formant": [-3, -1, 0, 2, 4],
        "effects": ["reverb", "chorus", "echo", "robot", "vintage"],
    },
    {
        "category": "Studio & Clarity",
        "emoji": "🎧",
        "names": ["Studio Voice", "Podcast Close", "Voiceover Clean", "Speech Clarity", "Crisp Narration", "Presenter", "Audiobook", "Tutorial", "Meeting Clear", "Streaming Clear", "Soft Compressor", "Broadcast Polish", "Warm Compressor", "Bright EQ", "Presence EQ", "Full Body", "Dry Voiceover", "Room Controlled", "Clear Midrange", "Smooth Presence", "Podcast Warm", "Podcast Bright", "Narration Deep", "Narration Light", "Studio Baritone", "Studio Tenor", "Studio Neutral", "Clean Dynamics", "Focused Speech", "Forward Voice", "Gentle Compression", "Natural EQ", "Low Noise Gate", "Clear Dialogue", "Close Broadcast", "Radio Presenter", "News Reader", "Documentary", "Explainer", "Professional Neutral"],
        "pitch": [0, -1, 1, 0.5, -0.5], "formant": [0, -0.5, 0.5],
        "effects": ["clear", "warm", "broadcast", "dry"],
    },
    {
        "category": "Creator & Character",
        "emoji": "🎬",
        "names": ["Energetic Gaming Host", "Calm Tech Explainer", "Confident Creator", "Friendly Streamer", "Cinematic Trailer Host", "Documentary Storyteller", "Podcast Co-Host", "Playful Commentator", "Warm Interviewer", "Curious Science Host", "Adventure Narrator", "Mystery Presenter", "Retro Game Host", "Fictional CEO", "Fictional Space Captain", "Fantasy Quest Guide", "Animated Sidekick", "Wise Story Mentor", "Comedic Announcer", "Esports Caster", "Lifestyle Presenter", "Travel Vlogger", "Book Reviewer", "Movie Critic", "Music Host", "Late Night Storyteller", "News Explainer", "Sports Commentator", "Friendly Teacher", "Studio Interview Host", "Virtual Assistant", "Sci-Fi Computer", "Steampunk Inventor", "Noir Narrator", "Adventure Pilot", "Arcade Announcer", "Gentle Story Reader", "Bold Promo Host", "Chill Creator", "Bright Tutorial Host"],
        "pitch": [-2, -1, 0, 1, 2], "formant": [-2, -1, 0, 1, 2],
        "effects": ["clear", "warm", "broadcast", "soft", None],
    },
    {
        "category": "Radio & Broadcast",
        "emoji": "📻",
        "names": ["Classic DJ", "Modern DJ", "FM Warmth", "AM Radio", "News Anchor", "Sports Host", "Late Night Host", "Morning Host", "Traffic Report", "Live Presenter", "Station ID", "Podcast Host", "Radio Drama", "Vintage Broadcast", "Bright FM", "Warm FM", "Deep FM", "Clean FM", "Compressed Radio", "Wide Broadcast", "Announcer", "Stadium PA", "Arena Host", "Event MC", "Public Address", "Studio Host", "Talk Radio", "Documentary Host", "Commercial Read", "Promo Voice", "Radio Neutral", "Broadcast Bass", "Broadcast Clarity", "Broadcast Presence", "Radio Smooth", "Radio Punch", "Radio Soft", "Radio Bright", "Radio Deep", "Radio Natural"],
        "pitch": [-2, -1, 0, 1, 2], "formant": [-1, 0, 1],
        "effects": ["broadcast", "warm", "clear", "vintage"],
    },
    {
        "category": "Whisper & Intimate",
        "emoji": "🌙",
        "names": ["Soft Whisper", "Close Whisper", "Breathy Story", "Quiet Confession", "Gentle Secret", "Intimate Narrator", "Soft Spoken Low", "Soft Spoken Bright", "Airy Whisper", "Calm ASMR Style", "Near Field", "Velvet Whisper", "Hushed Neutral", "Quiet Baritone", "Quiet Alto", "Whisper Podcast", "Late Night Calm", "Sleep Story", "Gentle Reassurance", "Soft Dialogue", "Warm Whisper", "Clear Whisper", "Low Whisper", "Light Whisper", "Dream Reader", "Quiet Presenter", "Soft Presence", "Featherlight", "Breath Control", "Close Narration", "Relaxed Intimate", "Gentle Room", "Whisper Radio", "Calm Companion", "Serene Voice", "Soft Focus", "Quiet Stream", "Tender Story", "Low Key Host", "Stillwater Narrator"],
        "pitch": [-2, -1, 0, 1, 0], "formant": [-1, 0, 1],
        "effects": ["soft", "dry", "warm", None],
    },
    {
        "category": "Classic & Retro",
        "emoji": "📼",
        "names": ["Classic Cinema", "Golden Age Radio", "Vintage Announcer", "Old Time Host", "Tape Deck Warmth", "Retro Telephone", "Classic Newsreel", "Noir Radio", "Vinyl Narrator", "Analog Studio", "Vintage Storyteller", "Old Cinema Voice", "Retro Podcast", "Classic DJ", "Vintage Presenter", "AM Story Host", "Film Trailer Retro", "Midcentury Host", "Radio Theatre", "Archive Narrator", "Warm Tape", "Soft Cassette", "Broadcast 1960s", "Broadcast 1970s", "Broadcast 1980s", "Retro Game Voice", "Classic Documentary", "Old School Announcer", "Vintage Interview", "Radio Serial", "Classic Sports Host", "Retro Commercial", "Nostalgic Narrator", "Mono Broadcast", "Tube Radio", "Lo-Fi Host", "Dusty Vinyl", "Classic Studio", "Analog Warmth", "Retro Story Reader"],
        "pitch": [-2, -1, 0, 1, 2], "formant": [-1, 0, 1],
        "effects": ["vintage", "warm", "broadcast", "dry"],
    },
    {
        "category": "Game & Stream",
        "emoji": "🎮",
        "names": ["Friendly Gamer", "Hype Caster", "Calm Squad Lead", "Tactical Narrator", "Quest Giver", "Arcade Host", "Speedrun Commentator", "Cozy Streamer", "High Energy Host", "Chill Lobby Voice", "Esports Analyst", "Match Reporter", "Game Tutorial Host", "Fantasy NPC Guide", "Sci-Fi Mission Control", "Retro Arcade Host", "Boss Intro", "Victory Announcer", "Friendly Teammate", "Stream Moderator", "Gaming Podcast", "Live Reaction", "Adventure Companion", "Dungeon Narrator", "Space Radio Operator", "Tournament Caster", "Patch Notes Host", "Community Update", "Game Show Host", "Pixel Radio", "Indie Game Guide", "Roleplay Narrator", "Mystery Quest Host", "Arena Commentator", "Co-op Partner", "Lore Explainer", "Virtual Host", "Console News Host", "Casual Commentary", "Creator Live Host"],
        "pitch": [-2, -1, 0, 1, 2], "formant": [-2, -1, 0, 1, 2],
        "effects": ["clear", "broadcast", "warm", "chorus", None],
    },
    {
        "category": "Documentary & Audiobook",
        "emoji": "📚",
        "names": ["Nature Documentary", "History Narrator", "Science Explainer", "Travel Documentary", "Calm Audiobook", "Thriller Reader", "Mystery Audiobook", "Children's Story Guide", "Educational Narrator", "Museum Audio Guide", "Planetarium Host", "Wildlife Presenter", "Investigative Narrator", "Biography Reader", "Historical Drama", "Classic Literature", "Modern Fiction", "Poetry Reader", "Longform Host", "Chapter Opener", "Documentary Deep", "Documentary Warm", "Documentary Clear", "Audiobook Neutral", "Audiobook Baritone", "Audiobook Alto", "Storybook Bright", "Storybook Gentle", "Science Podcast", "Learning Guide", "Exploration Host", "Archive Voiceover", "Fact Series Host", "Calm Lecturer", "Friendly Tutor", "Explainer Studio", "Narrative Journalist", "Research Presenter", "Reading Companion", "Bedtime Narrator"],
        "pitch": [-3, -1, 0, 1, 2], "formant": [-2, -1, 0, 1],
        "effects": ["warm", "clear", "soft", "dry", "broadcast"],
    },
    {
        "category": "Sci-Fi & Synthetic",
        "emoji": "🪐",
        "names": ["Soft Android", "Ship Computer", "AI Assistant", "Synthetic Guide", "Cybernetic Calm", "Digital Announcer", "Hologram Host", "Space Station PA", "Futuristic Radio", "Neon Robot", "Retro Computer", "Friendly Droid", "Alien Diplomat", "Starship Captain", "Mission Control", "Quantum Narrator", "Cyber Noir", "Glitch Lite", "Digital Whisper", "Vocoder Inspired", "Synthetic Bass", "Synthetic Bright", "Metallic Narrator", "Robotic Neutral", "Robot Broadcast", "Virtual Concierge", "System Voice", "Future News Host", "Space Documentary", "Deep Space Radio", "Galactic Guide", "Techno Host", "Cyber Streamer", "Data Reader", "Signal Operator", "AI Storyteller", "Future Podcast", "Digital Companion", "Astral Narrator", "Orbit Announcer"],
        "pitch": [-4, -2, 0, 2, 4], "formant": [-3, -1, 0, 2],
        "effects": ["robot", "chorus", "echo", "clear", None],
    },
    {
        "category": "Stage & Character",
        "emoji": "🎟️",
        "names": ["Stage Presenter", "Theatre Narrator", "Pantomime Guide", "Dramatic Hero", "Dramatic Villain", "Comedic Sidekick", "Mysterious Stranger", "Wise Mentor", "Royal Herald", "Town Crier", "Circus Announcer", "Fairytale Narrator", "Adventure Hero", "Gentle Giant", "Ancient Oracle", "Magical Librarian", "Forest Guardian", "Desert Wanderer", "Sea Captain", "Mountain Guide", "Detective Narrator", "Secret Agent", "Space Adventurer", "Time Traveler", "Inventor Character", "Storybook Villain", "Animated Host", "Comic Narrator", "Stage Whisper", "Grand Introduction", "Dramatic Reveal", "Warm Character", "Bold Character", "Soft Character", "Low Character", "Bright Character", "Mystic Guide", "Fantasy Royal", "Enchanted Host", "Character Voice Neutral"],
        "pitch": [-5, -3, -1, 1, 3], "formant": [-3, -1, 0, 1, 3],
        "effects": ["reverb", "chorus", "echo", "warm", "clear"],
    },
]


def _family_effect(kind: str | None, variant: int) -> dict:
    """Return only effect keys and parameter ranges supported by EffectsChain."""
    if kind is None:
        return {}
    if kind == "warm":
        return {"eq": {"enabled": True, "low": 2 + variant % 3, "high": -1}, "compressor": {"enabled": True, "threshold": -24, "ratio": 2.5}}
    if kind == "bass":
        return {"eq": {"enabled": True, "low": 5, "high": -3}, "compressor": {"enabled": True, "threshold": -26, "ratio": 3}}
    if kind == "clear":
        return {"eq": {"enabled": True, "low": -1, "high": 3 + variant % 3}, "compressor": {"enabled": True, "threshold": -22, "ratio": 2}}
    if kind == "soft":
        return {"compressor": {"enabled": True, "threshold": -28, "ratio": 2}, "reverb": {"enabled": True, "size": 0.12, "mix": 0.08}}
    if kind == "sparkle":
        return {"chorus": {"enabled": True, "rate": 0.35, "depth": 0.18, "mix": 0.12}, "eq": {"enabled": True, "low": -1, "high": 4}}
    if kind == "broadcast":
        return {"eq": {"enabled": True, "low": 2, "high": 2}, "compressor": {"enabled": True, "threshold": -25, "ratio": 4}}
    if kind == "reverb":
        return {"reverb": {"enabled": True, "size": 0.45 + (variant % 4) * 0.1, "mix": 0.18}}
    if kind == "chorus":
        return {"chorus": {"enabled": True, "rate": 0.5 + (variant % 3) * 0.2, "depth": 0.35, "mix": 0.25}}
    if kind == "echo":
        return {"echo": {"enabled": True, "time": 0.18 + (variant % 4) * 0.08, "feedback": 0.25, "mix": 0.18}}
    if kind == "robot":
        return {"robot": {"enabled": True, "freq": 55 + (variant % 5) * 18}}
    if kind == "vintage":
        return {"telephone": {"enabled": True}, "eq": {"enabled": True, "low": 2, "high": -2}}
    if kind == "dry":
        return {"gate": {"enabled": True, "threshold": -48}, "compressor": {"enabled": True, "threshold": -25, "ratio": 2.5}}
    return {}


def _build_expanded_presets() -> list[dict]:
    generated = []
    used_names = {preset["name"] for preset in BUILTIN_PRESETS}
    for family_index, family in enumerate(_PRESET_FAMILIES):
        for index, base_name in enumerate(family["names"]):
            name = base_name
            if name in used_names:
                name = f"{base_name} — {family['category']}"
            used_names.add(name)
            pitch = family["pitch"][index % len(family["pitch"])]
            formant = family["formant"][(index // 2 + index) % len(family["formant"])]
            effect_kind = family["effects"][index % len(family["effects"])]
            # Vary a few values across the family while staying within the UI's
            # +/-12 semitone pitch range and the formant controls' normal range.
            generated.append({
                "id": f"opera-{family_index + 1}-{index + 1:02d}",
                "name": name,
                "emoji": family["emoji"],
                "category": family["category"],
                "description": f"{family['category']} processing recipe. Pitch {pitch:+g} st, formant {formant:+g}.",
                "settings": {
                    "pitch_shift": pitch,
                    "formant_shift": formant,
                    "effects": _family_effect(effect_kind, index),
                },
            })
    return generated


EXPANDED_PRESETS = _build_expanded_presets()


class PresetStore:
    """Thread-safe JSON-file-backed store for user presets."""

    def __init__(self, path: str) -> None:
        self._path = Path(path)
        self._lock = threading.Lock()
        self._presets: dict[str, dict] = {}
        self._load()

    def _load(self) -> None:
        if not self._path.exists():
            return
        try:
            data = json.loads(self._path.read_text(encoding="utf-8"))
            if isinstance(data, list):
                self._presets = {
                    p["id"]: p
                    for p in data
                    if isinstance(p, dict) and "id" in p and "settings" in p
                }
            logger.info("Loaded %d user preset(s) from %s", len(self._presets), self._path)
        except Exception:
            logger.exception("Failed to load user presets from %s", self._path)

    def _flush_locked(self) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self._path.with_suffix(".tmp")
        tmp.write_text(
            json.dumps(list(self._presets.values()), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        tmp.replace(self._path)

    def list_builtin(self) -> list[dict]:
        return [{**p, "builtin": True, "category": p.get("category", "Classic")} for p in BUILTIN_PRESETS + EXPANDED_PRESETS]

    def list_user(self) -> list[dict]:
        with self._lock:
            return [{**p, "builtin": False} for p in self._presets.values()]

    def save(self, name: str, settings: dict, emoji: str = "⭐") -> dict:
        name = name.strip()
        if not name:
            raise ValueError("Preset name is empty")
        if len(name) > 40:
            raise ValueError("Preset name is too long (max 40 characters)")
        if not isinstance(settings, dict):
            raise ValueError("Preset settings must be an object")

        preset_id = f"user-{_slugify(name)}"
        preset = {
            "id": preset_id,
            "name": name,
            "emoji": (emoji or "⭐")[:4],
            "description": "Custom preset",
            # Stores the full Voice Lab state, not just pitch/formant/effects,
            # so applying a preset restores everything the user tuned.
            "settings": normalize_preset_settings(settings),
        }

        with self._lock:
            if preset_id not in self._presets and len(self._presets) >= MAX_USER_PRESETS:
                raise ValueError(f"Preset limit reached ({MAX_USER_PRESETS})")
            self._presets[preset_id] = preset
            self._flush_locked()
        logger.info("Saved user preset: %s", preset_id)
        return {**preset, "builtin": False}

    def delete(self, preset_id: str) -> None:
        with self._lock:
            if preset_id not in self._presets:
                raise KeyError(preset_id)
            del self._presets[preset_id]
            self._flush_locked()
        logger.info("Deleted user preset: %s", preset_id)

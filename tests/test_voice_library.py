from backend.services.preset_store import BUILTIN_PRESETS, EXPANDED_PRESETS, PresetStore


def test_expanded_voice_library_has_more_than_500_unique_presets():
    presets = BUILTIN_PRESETS + EXPANDED_PRESETS
    assert len(EXPANDED_PRESETS) == 520
    assert len(presets) == 536
    assert len({preset["id"] for preset in presets}) == len(presets)
    assert len({preset["name"] for preset in presets}) == len(presets)


def test_expanded_presets_have_supported_settings_and_categories():
    supported_effects = {
        "gate", "robot", "whisper", "telephone", "distortion", "bitcrush",
        "chorus", "echo", "reverb", "eq", "compressor", "gain",
    }
    expected_categories = {
        "Natural", "Deep & Bass", "Bright & High", "Character & Creative",
        "Studio & Clarity", "Radio & Broadcast", "Creator & Character",
        "Whisper & Intimate", "Classic & Retro", "Game & Stream",
        "Documentary & Audiobook", "Sci-Fi & Synthetic", "Stage & Character",
    }
    assert {preset["category"] for preset in EXPANDED_PRESETS} == expected_categories
    for preset in EXPANDED_PRESETS:
        settings = preset["settings"]
        assert -12 <= settings["pitch_shift"] <= 12
        assert -12 <= settings["formant_shift"] <= 12
        assert set(settings["effects"]).issubset(supported_effects)
        assert preset["description"]


def test_preset_store_serves_expanded_library_as_builtins(tmp_path):
    store = PresetStore(str(tmp_path / "presets.json"))
    builtins = store.list_builtin()
    assert len(builtins) >= 250
    assert all(item["builtin"] is True for item in builtins)
    assert any(item["category"] == "Deep & Bass" for item in builtins)

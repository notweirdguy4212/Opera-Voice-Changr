import React from 'react';
import { Gamepad2, MessageCircle, Monitor, Smartphone, ShieldCheck, Share2, Info } from 'lucide-react';

const targets = [
  { name: 'Discord', detail: 'Voice chat & communities', icon: MessageCircle, desktop: 'Use Opera as the input through a desktop virtual microphone device.', mobile: 'On Android/iOS, use a supported recording/share workflow; mobile apps generally cannot select another app’s processed microphone as a system-wide mic.' },
  { name: 'Roblox', detail: 'In-game voice chat', icon: Gamepad2, desktop: 'Select the virtual microphone in your operating system and Roblox voice settings.', mobile: 'Direct live microphone injection is not available from this app on standard Android/iOS. Use desktop routing where supported.' },
  { name: 'WhatsApp', detail: 'Calls & voice messages', icon: MessageCircle, desktop: 'Desktop call input can use a virtual microphone when the OS exposes one.', mobile: 'Use converted recordings for voice messages. Live call microphone replacement is restricted by mobile OS app isolation.' },
];

export default function CompatibilityHub() {
  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: 'Opera Voice Changer', text: 'My Opera Voice Changer studio', url }); } catch { /* user cancelled */ }
    } else if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
    }
  };

  return (
    <section className="opera-compat panel p-4 sm:p-5" aria-labelledby="compat-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="panel-kicker">CONNECTIVITY HUB</p>
          <h2 id="compat-title" className="panel-title">Play across your apps</h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-fg-muted">Compatibility guidance for voice chat, games and messaging. Actual live routing depends on your device and operating-system permissions.</p>
        </div>
        <button type="button" onClick={share} className="frost-control inline-flex min-h-10 items-center gap-2 px-3 text-xs font-medium" aria-label="Share Opera Voice Changer">
          <Share2 className="h-4 w-4" /> Share app
        </button>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {targets.map(({ name, detail, icon: Icon, desktop, mobile }) => (
          <article key={name} className="rounded-xl border border-line bg-raised p-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-line-strong bg-control-hover text-fg"><Icon className="h-5 w-5" /></span>
              <div><h3 className="text-sm font-semibold text-fg">{name}</h3><p className="text-[11px] text-fg-muted">{detail}</p></div>
            </div>
            <div className="mt-3 space-y-2 text-xs leading-5">
              <p className="flex gap-2 text-fg-muted"><Monitor className="mt-0.5 h-4 w-4 shrink-0 text-fg-subtle" />{desktop}</p>
              <p className="flex gap-2 text-fg-muted"><Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-fg-subtle" />{mobile}</p>
            </div>
          </article>
        ))}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="flex gap-2 rounded-lg border border-line bg-sunken p-3 text-xs leading-5 text-fg-muted"><ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" /><span><strong className="text-fg">Private by design.</strong> Keep the conversion backend on a trusted network, use HTTPS for remote connections, and never publish an open microphone endpoint.</span></div>
        <div className="flex gap-2 rounded-lg border border-line bg-sunken p-3 text-xs leading-5 text-fg-muted"><Info className="h-4 w-4 shrink-0 text-fg-subtle" /><span><strong className="text-fg">Mobile reality check.</strong> Android and iOS isolate app audio. A normal APK cannot silently become a universal microphone for Discord, Roblox or WhatsApp. Desktop virtual-audio routing is the reliable live-call path.</span></div>
      </div>
    </section>
  );
}

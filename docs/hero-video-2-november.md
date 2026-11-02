# Approved homepage hero video

Uses the user-supplied public/videos/hero-van.mp4 unmodified. The video loops silently and plays inline on mobile. Playback starts muted, and the volume handler prevents unmuting. Pause/Play controls actual video playback. Reduced-motion users start with the still image and can choose Play. Failed video loading leaves the existing branded image; blocked autoplay leaves a working Play button.

Video uses object-fit: cover at the existing hero dimensions. Desktop/tablet focus is 65%; phone focus is 70%. This fills the hero without stretching; narrower screens crop the landscape video. Text, quote links, maintenance behavior and all booking pages are unchanged. No CSS pan/zoom remains.

Tests simulate media events, playback rejection, preference changes and failure. CSS and TypeScript checks pass; real phone/tablet/desktop playback and exact crop remain deployment acceptance checks. The apply/push script runs the normal frontend production build before committing. No database update, backend change, generated-media edit or paid service is included.

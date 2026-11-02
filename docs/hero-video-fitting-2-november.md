# Approved hero video fitting correction

The former full-height background cropped the landscape video on portrait screens. The hero now has a separate 16:9 media area with object-fit: contain and a centred, contained image fallback. The full source frame remains visible without stretching. Phones and tablets stack the existing text and buttons above the video; screens 1280px and wider place text and video side by side. Grid tracks allow shrinking without horizontal overflow. The pause/play button is contained inside the media area and cannot overlap the quote or Learn More buttons.

Copy, links, maintenance handling, muted looping playback, playback failure, reduced-motion support, the original MP4, and all other pages remain unchanged. No backend or database change.

Frontend types and the existing regression suites are checked in isolation. Browser security policy prevented opening the local preview, so no visual browser or real-device verification is claimed. The supplied script runs the normal production frontend build before commit and push. After deployment check the full van at 390px/440px, 768px/1024px and desktop widths, plus Play/Pause and silent playback.

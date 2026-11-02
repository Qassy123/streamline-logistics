# Approved paused hero fitting fix

The 1280x720 video matches the 16:9 media area. The old poster image did not match that ratio and was letterboxed by the video element. Remove that video poster attribute and use the existing separate fallback layer with background-size: cover. Hide the video until loadeddata confirms a decoded frame; reset that visibility on emptied. Once loaded, pause keeps the actual video frame, which fits without side bars. Load errors retain the existing full-box fallback.

Only hero image readiness and fallback fitting change. Video bytes, muted playback, loop, controls, responsive layout, text, links and all other pages remain unchanged. No database update. Checks use isolated media-event mocks and TypeScript; deployed visual acceptance remains a browser check.

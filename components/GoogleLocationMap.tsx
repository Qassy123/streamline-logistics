"use client";

type Props = {
  latitude: number;
  longitude: number;
  title?: string;
  className?: string;
};

export default function GoogleLocationMap({
  latitude, longitude, title = "Driver location map", className = "h-full w-full",
}: Props) {
  const valid = Number.isFinite(latitude) && Number.isFinite(longitude)
    && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY?.trim();

  if (!valid || !key) {
    return (
      <div className={`${className} grid min-h-[200px] place-items-center bg-slate-50 p-6 text-center`}>
        <div>
          <p className="text-sm font-semibold text-slate-600">
            {valid ? "The map is currently unavailable." : "Waiting for a valid location."}
          </p>
          {valid && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-sm font-bold text-blue-700 underline"
            >
              Open location in Google Maps
            </a>
          )}
        </div>
      </div>
    );
  }

  const params = new URLSearchParams({
    key, center: `${latitude},${longitude}`, zoom: "15", maptype: "roadmap", region: "GB",
  });

  return (
    <iframe
      title={title}
      src={`https://www.google.com/maps/embed/v1/view?${params.toString()}`}
      className={className}
      style={{ border: 0, minWidth: 200, minHeight: 200 }}
      loading="lazy"
      referrerPolicy="strict-origin-when-cross-origin"
      allowFullScreen
    />
  );
}

import { MapPin, Navigation, Route } from "lucide-react";

const mapboxAccessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
const kenyaCenter = [37.9062, -0.0236];
const countyCoordinates = {
  Nairobi: [36.8219, -1.2921],
  Mombasa: [39.6682, -4.0435],
  Kisumu: [34.7617, -0.0917],
  Nakuru: [36.0800, -0.3031],
  Kiambu: [36.8356, -1.1714],
  Machakos: [37.2634, -1.5177],
  Kajiado: [36.7819, -1.8524],
  Meru: [37.6559, 0.0463],
  Kisii: [34.7679, -0.6773],
  Kakamega: [34.7519, 0.2827],
  "Uasin Gishu": [35.2699, 0.5143],
  Nyeri: [36.9476, -0.4201],
  Kilifi: [39.8499, -3.6305],
  Bungoma: [34.5606, 0.5695],
  Kericho: [35.2831, -0.3677],
};

function hasLocation(person) {
  return Number.isFinite(person?.location?.lat) && Number.isFinite(person?.location?.lng);
}

function coordinatesFor(person) {
  if (hasLocation(person)) return [person.location.lng, person.location.lat];
  return countyCoordinates[person?.county] || null;
}

function mapboxStaticImageUrl(points) {
  const accessToken = encodeURIComponent(mapboxAccessToken);
  const overlays = points
    .map((point) => `pin-s+${point.color.replace("#", "")}(${point.coordinates.join(",")})`)
    .join(",");
  const viewport = points.length > 1 ? "auto" : `${kenyaCenter.join(",")},5.2,0`;
  const overlayPath = overlays ? `${overlays}/` : "";

  return `https://api.mapbox.com/styles/v1/mapbox/navigation-day-v1/static/${overlayPath}${viewport}/900x420@2x?padding=80&logo=false&access_token=${accessToken}`;
}

export default function DeliveryMap({ profile, selected }) {
  const points = [
    coordinatesFor(profile) && {
      label: "You",
      color: "#146b55",
      coordinates: coordinatesFor(profile),
    },
    coordinatesFor(selected) && {
      label: selected.name || "Selected user",
      color: "#d04b2f",
      coordinates: coordinatesFor(selected),
    },
  ].filter(Boolean);
  
  const mapUrl = mapboxAccessToken ? mapboxStaticImageUrl(points) : "";

  return (
    <div className="map-panel professional-panel">
      <div className="map-header">
        <div>
          <p className="eyebrow">Live location</p>
          <h2>Delivery map</h2>
        </div>
        <span className="badge"><Navigation aria-hidden="true" /> {points.length ? `${points.length} pin${points.length === 1 ? "" : "s"}` : "Kenya view"}</span>
      </div>
      {mapboxAccessToken ? (
        <div className="map-frame">
          <img src={mapUrl} alt="Map showing shared delivery locations" />
          <div className="map-legend">
            {points.map((point) => (
              <span key={point.label}>
                <i style={{ background: point.color }} />
                {point.label}
              </span>
            ))}
            {!points.length && <span>Share a location to add a pin.</span>}
          </div>
        </div>
      ) : (
        <div className="map-placeholder">
          <MapPin aria-hidden="true" />
          <p>Add VITE_MAPBOX_ACCESS_TOKEN to frontend/.env to load the map.</p>
        </div>
      )}
      <div className="route-summary">
        <span><Route aria-hidden="true" /> Pickup: {profile.county || "Not set"}</span>
        <span>Drop partner: {selected?.county || "Select a partner"}</span>
      </div>
    </div>
  );
}

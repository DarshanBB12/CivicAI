import React from 'react';
import { MapContainer, TileLayer, CircleMarker, Circle, Popup, useMapEvents } from 'react-leaflet';

export const DEFAULT_CENTER = [12.9716, 77.5946]; // Bengaluru default

const PRIORITY_COLORS = {
  HIGH: '#dc2626',
  MEDIUM: '#f59e0b',
  LOW: '#16a34a'
};

const CATEGORY_ICONS = {
  'Road Damage': '🛣️',
  Waterlogging: '🌊',
  Garbage: '🗑️',
  Drainage: '🚰',
  Streetlight: '💡',
  'Public Infrastructure': '🏛️',
  Other: '📍'
};

function MapClickHandler({ onPick }) {
  useMapEvents({
    click: (e) => {
      if (onPick) {
        onPick(e.latlng.lat, e.latlng.lng);
      }
    }
  });
  return null;
}

// Interactive Map for Admin & Citizen tracking
export function ComplaintMap({
  complaints = [],
  hotspots = [],
  onSelectComplaint,
  selectedComplaintId,
  center = DEFAULT_CENTER,
  zoom = 12
}) {
  return (
    <MapContainer center={center} zoom={zoom} scrollWheelZoom className="h-full w-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Render Hotspot density zones */}
      {hotspots.map((h, idx) => (
        <Circle
          key={`hotspot-${idx}`}
          center={[h.latitude, h.longitude]}
          radius={380}
          pathOptions={{
            color: '#7c3aed',
            fillColor: '#8b5cf6',
            fillOpacity: 0.18,
            weight: 2,
            dashArray: '6, 6'
          }}
        >
          <Popup>
            <div className="p-1 min-w-[200px]">
              <div className="flex items-center gap-1.5 font-bold text-purple-900 text-sm mb-1">
                <span>🔥 Hotspot Zone</span>
                <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full">
                  {h.count} reports
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-800">{h.label}</p>
              <div className="mt-1 text-xs text-slate-600 space-y-0.5">
                <div>Primary issue: <b className="text-slate-800">{h.topCategory || h.categories?.[0]}</b></div>
                <div className="text-red-600 font-medium">⚠️ {h.highPriority} High Priority Issues</div>
              </div>
              <p className="mt-1.5 text-[11px] text-purple-800 italic bg-purple-50 p-1.5 rounded border border-purple-200">
                {h.recommendation || 'Area inspection recommended.'}
              </p>
            </div>
          </Popup>
        </Circle>
      ))}

      {/* Render Complaints Markers */}
      {complaints.map((c) => {
        if (typeof c.latitude !== 'number' || typeof c.longitude !== 'number') return null;
        const isSelected = selectedComplaintId === c._id;
        const color = PRIORITY_COLORS[c.priority] || '#3b82f6';

        return (
          <CircleMarker
            key={c._id}
            center={[c.latitude, c.longitude]}
            radius={isSelected ? 10 : 7}
            pathOptions={{
              color: isSelected ? '#0f172a' : color,
              fillColor: color,
              fillOpacity: isSelected ? 1 : 0.85,
              weight: isSelected ? 3 : 1.5
            }}
            eventHandlers={{
              click: () => {
                if (onSelectComplaint) onSelectComplaint(c);
              }
            }}
          >
            <Popup>
              <div className="p-1 min-w-[220px]">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-mono text-xs font-bold text-teal-800">{c.complaintId}</span>
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-bold text-white uppercase"
                    style={{ backgroundColor: color }}
                  >
                    {c.priority}
                  </span>
                </div>
                <div className="text-xs font-bold text-slate-900 mb-1">
                  {CATEGORY_ICONS[c.category] || '📍'} {c.title}
                </div>
                <p className="text-xs text-slate-600 line-clamp-2 mb-1.5">
                  {c.aiSummary || c.description}
                </p>
                <div className="flex items-center justify-between text-[11px] pt-1 border-t text-slate-500">
                  <span>Status: <b className="text-slate-800">{c.status}</b></span>
                  <span>{c.category}</span>
                </div>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}

// Single Pin Selector for Citizen Reporting
export function PinMap({ pos, onPick, center = DEFAULT_CENTER, zoom = 13 }) {
  return (
    <MapContainer center={pos || center} zoom={zoom} scrollWheelZoom className="h-full w-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapClickHandler onPick={onPick} />
      {pos && (
        <CircleMarker
          center={pos}
          radius={9}
          pathOptions={{
            color: '#0f766e',
            fillColor: '#14b8a6',
            fillOpacity: 0.9,
            weight: 3
          }}
        >
          <Popup>Selected incident pin: {pos[0].toFixed(5)}, {pos[1].toFixed(5)}</Popup>
        </CircleMarker>
      )}
    </MapContainer>
  );
}

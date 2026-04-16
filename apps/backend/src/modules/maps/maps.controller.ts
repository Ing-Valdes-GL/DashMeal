import type { Request, Response, NextFunction } from "express";
import { env } from "../../config/env.js";
import { sendSuccess } from "../../utils/response.js";
import { AppError } from "../../middleware/errorHandler.js";

const MAPS_BASE = "https://maps.googleapis.com/maps/api";

// ─── Autocomplete ─────────────────────────────────────────────────────────────
// GET /maps/autocomplete?input=<text>&sessiontoken=<uuid>
export async function autocomplete(req: Request, res: Response, next: NextFunction) {
  try {
    const { input, sessiontoken, language = "fr" } = req.query;
    if (!input || String(input).trim().length < 2) {
      sendSuccess(res, []);
      return;
    }

    const params = new URLSearchParams({
      input: String(input),
      key: env.GOOGLE_MAPS_API_KEY,
      language: String(language),
      // Prioritise Central Africa but don't hard-restrict to one country
      location: "3.848,11.502", // centre Yaoundé approx
      radius: "500000",         // 500 km radius bias
      ...(sessiontoken ? { sessiontoken: String(sessiontoken) } : {}),
    });

    const resp = await fetch(`${MAPS_BASE}/place/autocomplete/json?${params}`);
    if (!resp.ok) throw new AppError(502, "MAPS_ERROR", "Erreur Google Places");

    const data = await resp.json() as {
      status: string;
      predictions: Array<{ place_id: string; description: string }>;
      error_message?: string;
    };

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      console.error("[Maps] Autocomplete error:", data.status, data.error_message);
      sendSuccess(res, []);
      return;
    }

    sendSuccess(res, (data.predictions ?? []).map((p) => ({
      place_id: p.place_id,
      description: p.description,
    })));
  } catch (err) {
    next(err);
  }
}

// ─── Place details ─────────────────────────────────────────────────────────────
// GET /maps/place?place_id=<id>&sessiontoken=<uuid>
export async function placeDetails(req: Request, res: Response, next: NextFunction) {
  try {
    const { place_id, sessiontoken } = req.query;
    if (!place_id) throw new AppError(400, "MISSING_PARAM", "Paramètre 'place_id' requis");

    const params = new URLSearchParams({
      place_id: String(place_id),
      fields: "geometry,formatted_address",
      key: env.GOOGLE_MAPS_API_KEY,
      language: "fr",
      ...(sessiontoken ? { sessiontoken: String(sessiontoken) } : {}),
    });

    const resp = await fetch(`${MAPS_BASE}/place/details/json?${params}`);
    if (!resp.ok) throw new AppError(502, "MAPS_ERROR", "Erreur Google Places Details");

    const data = await resp.json() as {
      status: string;
      result?: {
        formatted_address: string;
        geometry: { location: { lat: number; lng: number } };
      };
      error_message?: string;
    };

    if (data.status !== "OK" || !data.result) {
      console.error("[Maps] PlaceDetails error:", data.status, data.error_message);
      throw new AppError(502, "MAPS_ERROR", `Google Places Details: ${data.status}`);
    }

    sendSuccess(res, {
      formatted_address: data.result.formatted_address,
      lat: data.result.geometry.location.lat,
      lng: data.result.geometry.location.lng,
    });
  } catch (err) {
    next(err);
  }
}

// ─── Reverse geocoding ────────────────────────────────────────────────────────
// GET /maps/reverse?lat=<lat>&lng=<lng>
export async function reverseGeocode(req: Request, res: Response, next: NextFunction) {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) throw new AppError(400, "MISSING_PARAM", "Paramètres 'lat' et 'lng' requis");

    const latNum = parseFloat(String(lat));
    const lngNum = parseFloat(String(lng));
    if (isNaN(latNum) || isNaN(lngNum)) {
      throw new AppError(400, "INVALID_PARAM", "Coordonnées invalides");
    }

    const params = new URLSearchParams({
      latlng: `${latNum},${lngNum}`,
      key: env.GOOGLE_MAPS_API_KEY,
      language: "fr",
    });

    const resp = await fetch(`${MAPS_BASE}/geocode/json?${params}`);
    if (!resp.ok) throw new AppError(502, "MAPS_ERROR", "Erreur Google Geocoding");

    const data = await resp.json() as {
      status: string;
      results: Array<{ formatted_address: string }>;
    };

    if (data.status !== "OK" || !data.results.length) {
      sendSuccess(res, { formatted_address: null, lat: latNum, lng: lngNum });
      return;
    }

    sendSuccess(res, {
      formatted_address: data.results[0].formatted_address,
      lat: latNum,
      lng: lngNum,
    });
  } catch (err) {
    next(err);
  }
}

// ─── Static map image proxy ───────────────────────────────────────────────────
// GET /maps/staticmap?driverlat=&driverlng=&destlat=&destlng=&zoom=14&size=600x300
// Public endpoint — proxies Google Static Maps, API key stays server-side.
export async function staticMap(req: Request, res: Response, next: NextFunction) {
  try {
    const {
      driverlat, driverlng,   // livreur (optionnel)
      destlat, destlng,       // destination de livraison
      zoom = "14",
      size = "600x300",
    } = req.query;

    if (!destlat || !destlng) {
      throw new AppError(400, "MISSING_PARAM", "destlat et destlng sont requis");
    }

    const hasDriver = driverlat && driverlng;

    // Center: on driver if available, else destination
    const centerLat = hasDriver ? driverlat : destlat;
    const centerLng = hasDriver ? driverlng : destlng;

    // Build query string manually (duplicate keys not supported by URLSearchParams)
    const parts: string[] = [
      `center=${centerLat},${centerLng}`,
      `zoom=${zoom}`,
      `size=${size}`,
      `scale=2`,
      `language=fr`,
      `maptype=roadmap`,
      `key=${env.GOOGLE_MAPS_API_KEY}`,
    ];

    // Destination marker — red pin
    parts.push(`markers=color:red%7Clabel:D%7C${destlat},${destlng}`);

    // Driver marker — blue pin (only when position known)
    if (hasDriver) {
      parts.push(`markers=color:blue%7Clabel:L%7C${driverlat},${driverlng}`);
    }

    const mapUrl = `${MAPS_BASE}/staticmap?${parts.join("&")}`;

    const imgResp = await fetch(mapUrl);
    if (!imgResp.ok) {
      throw new AppError(502, "MAPS_ERROR", `Google Static Maps erreur (${imgResp.status})`);
    }

    const contentType = imgResp.headers.get("content-type") ?? "image/png";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "no-cache, max-age=0");

    const buffer = await imgResp.arrayBuffer();
    res.end(Buffer.from(buffer));
  } catch (err) {
    next(err);
  }
}

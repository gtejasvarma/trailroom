"use client";
import { useCallback, useEffect, useState } from "react";
import { api, type PhotoSummary } from "./api";
import { messageOf } from "./flow";

/** The person's photos, with a reload. `loaded` is false until the first answer. */
export function usePhotos() {
  const [photos, setPhotos] = useState<PhotoSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const r = await api.photos();
      setPhotos(r.photos);
      setError(null);
    } catch (e) {
      setError(messageOf(e));
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { photos, loaded, error, reload };
}

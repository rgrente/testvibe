"use server";

import { adminUpdateEvent } from "@testvibe/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function updateEventAction(formData: FormData) {
  const id = Number(formData.get("id"));
  const personId = Number(formData.get("personId"));
  const type = formData.get("type")?.toString() as
    | "naissance"
    | "décès"
    | "mariage"
    | "résidence"
    | "libre"
    | undefined;
  const label = formData.get("label")?.toString().trim() || null;
  const eventDate = formData.get("eventDate")?.toString().trim() || null;
  const description = formData.get("description")?.toString().trim() || null;
  const place = formData.get("place")?.toString().trim() || null;
  const latStr = formData.get("latitude")?.toString().trim();
  const lngStr = formData.get("longitude")?.toString().trim();
  const latitude = latStr ? Number(latStr) : null;
  const longitude = lngStr ? Number(lngStr) : null;

  if (!id || !personId || !type) {
    redirect(`/admin/persons/${personId}/events?error=champs_requis`);
  }
  try {
    await adminUpdateEvent(id, {
      personId,
      type,
      label,
      eventDate,
      description,
      place,
      latitude,
      longitude,
    });
  } catch {
    redirect(`/admin/persons/${personId}/events?error=validation`);
  }
  revalidatePath(`/admin/persons/${personId}/events`);
  redirect(`/admin/persons/${personId}/events`);
}

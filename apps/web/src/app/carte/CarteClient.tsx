"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { MapLocation } from "@testvibe/core";
import MapClient from "@/components/MapClient";

interface CarteClientProps {
  locations: MapLocation[];
  allPersons: { id: number; name: string }[];
  initialPersonId: number | null;
  initialBranch: "none" | "ancestors" | "descendants";
  initialDateFrom: string;
  initialDateTo: string;
  branchPersonIds: number[];
}

export default function CarteClient({
  locations,
  allPersons,
  initialPersonId,
  initialBranch,
  initialDateFrom,
  initialDateTo,
  branchPersonIds,
}: CarteClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [dateFrom, setDateFrom] = useState(initialDateFrom);
  const [dateTo, setDateTo] = useState(initialDateTo);
  const [branchMode, setBranchMode] = useState(initialBranch);
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(initialPersonId);
  const [selectedPersonIds, setSelectedPersonIds] = useState<number[]>(branchPersonIds);

  // Sync branchPersonIds when props change (SSR → client hydration)
  useEffect(() => {
    setSelectedPersonIds(branchPersonIds);
  }, [branchPersonIds]);

  const pushFilters = (
    person: number | null,
    branch: string,
    from: string,
    to: string,
  ) => {
    const params = new URLSearchParams(searchParams.toString());
    if (person) params.set("person", String(person));
    else params.delete("person");
    if (branch && branch !== "none") params.set("branche", branch);
    else params.delete("branche");
    if (from) params.set("from", from);
    else params.delete("from");
    if (to) params.set("to", to);
    else params.delete("to");
    router.push(`/carte?${params.toString()}`, { scroll: false });
  };

  // Navigate so the server resolves the selected branch
  const loadBranch = (
    person: number | null,
    branch: "none" | "ancestors" | "descendants",
  ) => {
    if (branch !== "none" && person) {
      // Include the branch param to trigger server-side resolution
      router.push(`/carte?person=${person}&branche=${branch}&from=${dateFrom}&to=${dateTo}`);
    } else {
      // Clear branch filter client-side
      setSelectedPersonIds([]);
      pushFilters(person, "none", dateFrom, dateTo);
    }
  };

  return (
    <MapClient
      locations={locations}
      selectedPersonIds={selectedPersonIds}
      dateFrom={dateFrom}
      dateTo={dateTo}
      branchMode={branchMode}
      onDateFromChange={(v) => {
        setDateFrom(v);
        pushFilters(selectedPersonId, branchMode, v, dateTo);
      }}
      onDateToChange={(v) => {
        setDateTo(v);
        pushFilters(selectedPersonId, branchMode, dateFrom, v);
      }}
      onBranchModeChange={(v) => {
        setBranchMode(v);
        loadBranch(selectedPersonId, v);
      }}
      allPersons={allPersons}
      selectedPersonId={selectedPersonId}
      onSelectPerson={(id) => {
        setSelectedPersonId(id);
        if (!id) loadBranch(null, "none");
        else if (branchMode !== "none") loadBranch(id, branchMode);
        else pushFilters(id, branchMode, dateFrom, dateTo);
      }}
    />
  );
}

import {
  type AtlasJsonDataset,
  type EnrollmentStationMarker,
  fetchRouteBuilderDataset,
  fetchEnrollmentStationMarkers,
  fetchNavigatorAssignedEnrollees,
  getJourneySteps,
  getSelectedJourney,
  getSelectedParticipant,
} from "@atlas/shared";
import { useEffect, useMemo, useState } from "react";
import { Pressable, SafeAreaView, ScrollView, Text, View } from "react-native";
import { hasMobileSupabaseConfig, supabase } from "../../src/lib/supabase";

interface MobileParticipantCard {
  id: string;
  name: string;
  subtitle: string;
  phaseLabel: string;
  enrollmentId: string | null;
}

export default function MobileNavigationScreen() {
  // Keep a full local fallback dataset so this screen can still render in simulator sessions without live backend data.
  const [dataset, setDataset] = useState<AtlasJsonDataset>({
    participants: [],
    instructionBoms: [],
    routingSteps: [],
    routeTemplates: [],
    journeyAssignments: [],
  });
  const [participantCards, setParticipantCards] = useState<MobileParticipantCard[]>([]);
  const [selectedParticipantId, setSelectedParticipantId] = useState("");
  const [liveMarkers, setLiveMarkers] = useState<EnrollmentStationMarker[]>([]);
  const [useLiveData, setUseLiveData] = useState(false);
  const [liveLoadError, setLiveLoadError] = useState<string | null>(null);

  const selectedParticipant = useMemo(
    () => getSelectedParticipant(dataset, selectedParticipantId),
    [selectedParticipantId],
  );
  const selectedJourney = useMemo(
    () => getSelectedJourney(dataset, selectedParticipantId),
    [selectedParticipantId],
  );
  const selectedSteps = useMemo(
    () => getJourneySteps(dataset, selectedJourney),
    [selectedJourney],
  );
  const selectedCard = useMemo(
    () => participantCards.find((participant) => participant.id === selectedParticipantId) || null,
    [participantCards, selectedParticipantId],
  );

  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      if (!supabase || !hasMobileSupabaseConfig) {
        setLiveLoadError("Supabase configuration not found.");
        return;
      }
      try {
        // Load the shared route builder snapshot first; downstream selectors assume dataset shape is complete.
        const sharedDataset = await fetchRouteBuilderDataset(supabase);
        if (cancelled) return;
        setDataset(sharedDataset);

        // These cards mirror participant records so the UI still works when navigator assignments are missing.
        const fallbackCards: MobileParticipantCard[] = sharedDataset.participants.map((participant) => ({
          id: participant.id,
          name: participant.name,
          subtitle: `${participant.county} • ${Math.round(participant.readinessScore * 100)}% readiness`,
          phaseLabel: participant.currentPhase,
          enrollmentId: participant.id,
        }));

        const assignedEnrollees = await fetchNavigatorAssignedEnrollees(supabase);
        if (cancelled) return;
        const nextCards =
          assignedEnrollees.length > 0
            ? assignedEnrollees.map((enrollee) => ({
                id: enrollee.enrolleeId,
                name: enrollee.enrolleeName,
                subtitle: enrollee.caseId ? `case ${enrollee.caseId}` : "active enrollment",
                phaseLabel: enrollee.currentPhase,
                enrollmentId: enrollee.enrollmentId,
              }))
            : fallbackCards;
        setParticipantCards(nextCards);
        // Selection defaults to first card; detail panes and marker fetches rely on a stable selected id.
        setSelectedParticipantId(nextCards[0]?.id || "");
        setUseLiveData(true);
        setLiveLoadError(null);
      } catch (error) {
        if (cancelled) return;
        // Network or auth failures intentionally degrade to fallback journey data instead of blanking the page.
        setUseLiveData(false);
        setLiveLoadError(error instanceof Error ? error.message : "unable to load live data");
      }
    }
    hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadLiveMarkers() {
      if (!useLiveData || !supabase) return;
      if (!selectedCard?.enrollmentId) {
        // Clear stale marker state when selection changes to a participant that has no live enrollment context.
        setLiveMarkers([]);
        return;
      }
      try {
        const markers = await fetchEnrollmentStationMarkers(supabase, selectedCard.enrollmentId);
        if (!cancelled) {
          setLiveMarkers(markers);
        }
      } catch {
        if (!cancelled) {
          // Marker failures should not block primary participant browsing, so we recover to an empty strip.
          setLiveMarkers([]);
        }
      }
    }
    loadLiveMarkers();
    return () => {
      cancelled = true;
    };
  }, [selectedCard?.enrollmentId, useLiveData]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#000000" }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <View style={{ borderWidth: 1, borderColor: "#2c2c2c", borderRadius: 14, padding: 12 }}>
          <Text style={{ color: "#a7a9ac", fontSize: 11, letterSpacing: 1, textTransform: "uppercase" }}>
            participant context
          </Text>
          <Text style={{ color: useLiveData ? "#7de08e" : "#a7a9ac", fontSize: 12, marginTop: 8 }}>
            source: {useLiveData ? "supabase live" : "no live dataset"}
          </Text>
          {liveLoadError ? <Text style={{ color: "#ff7373", fontSize: 12 }}>{liveLoadError}</Text> : null}
          <View style={{ gap: 8, marginTop: 10 }}>
            {participantCards.map((participant) => {
              const selected = participant.id === selectedParticipantId;
              return (
                <Pressable
                  key={participant.id}
                  onPress={() => setSelectedParticipantId(participant.id)}
                  style={{
                    borderWidth: 1,
                    borderColor: selected ? "#fccc0a" : "#2c2c2c",
                    borderRadius: 10,
                    padding: 10,
                    backgroundColor: selected ? "#151515" : "#090909",
                  }}
                >
                  <Text style={{ color: "#ffffff", fontWeight: "600" }}>{participant.name}</Text>
                  <Text style={{ color: "#a7a9ac", fontSize: 12 }}>
                    {participant.subtitle} • {participant.phaseLabel}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ borderWidth: 1, borderColor: "#2c2c2c", borderRadius: 14, padding: 12 }}>
          <Text style={{ color: "#a7a9ac", fontSize: 11, letterSpacing: 1, textTransform: "uppercase" }}>
            journey strip
          </Text>
          {useLiveData ? (
            <View style={{ gap: 8, marginTop: 10 }}>
              {liveMarkers.map((marker, index) => {
                return (
                  <View
                    key={marker.routePlanStopId}
                    style={{
                      borderWidth: 1,
                      borderColor: marker.status === "active" ? "#ffffff" : "#2c2c2c",
                      borderRadius: 10,
                      padding: 10,
                    }}
                  >
                    <Text style={{ color: "#ffffff", fontWeight: "600" }}>
                      {index + 1}. {marker.stationName}
                    </Text>
                    <Text style={{ color: "#a7a9ac", fontSize: 12 }}>
                      {new Date(marker.assignedAt).toLocaleDateString()} • {marker.status}
                    </Text>
                  </View>
                );
              })}
              {liveMarkers.length === 0 ? (
                <Text style={{ color: "#fccc0a" }}>
                  no live route plan stops for {selectedCard?.name || "selected participant"}.
                </Text>
              ) : null}
            </View>
          ) : selectedSteps.length === 0 ? (
            <Text style={{ color: "#fccc0a", marginTop: 10 }}>
              no journey assigned yet for {selectedParticipant?.name || "selected participant"}.
            </Text>
          ) : (
            <View style={{ gap: 8, marginTop: 10 }}>
              {selectedSteps.map((step, index) => {
                const isCurrent = index === (selectedJourney?.currentStepIndex || 0);
                return (
                  <View
                    key={step.id}
                    style={{
                      borderWidth: 1,
                      borderColor: isCurrent ? "#ffffff" : "#2c2c2c",
                      borderRadius: 10,
                      padding: 10,
                    }}
                  >
                    <Text style={{ color: "#ffffff", fontWeight: "600" }}>
                      {index + 1}. {step.label}
                    </Text>
                    <Text style={{ color: "#a7a9ac", fontSize: 12 }}>{step.instruction}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <Pressable
          onPress={() => supabase?.auth.signOut()}
          style={{
            borderWidth: 1,
            borderColor: "#2c2c2c",
            borderRadius: 10,
            padding: 12,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#ffffff" }}>sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

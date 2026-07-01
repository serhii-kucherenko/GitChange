import type { Evidence } from "../schema/zod/evidence.js";
import type { NamedEra } from "../schema/zod/eras.js";
import { assertNever } from "../schema/zod/eras.js";
import type { ErasArtifact } from "../schema/zod/eras.js";
import type { TourChapter, TourStop } from "../schema/zod/tours.js";

const MIN_CHAPTERS = 4;
const MAX_CHAPTERS = 6;

interface EraGroup {
  eraIds: string[];
  eras: NamedEra[];
  startAt: number;
  endAt: number;
}

function eraSpan(group: EraGroup): number {
  return group.endAt - group.startAt;
}

function primaryCommitSha(era: NamedEra): string | null {
  const first = era.evidence[0];
  if (!first) {
    return null;
  }

  switch (first.type) {
    case "commit":
      return first.sha;
    case "file":
    case "doc":
    case "hunk":
      return first.commitSha;
    case "interview":
      return null;
    default:
      assertNever(first);
  }
}

function placeholderStop(era: NamedEra, suffix: string): TourStop {
  const commitSha = primaryCommitSha(era) ?? era.startCommitSha;
  const evidence: Evidence[] =
    era.evidence.length > 0 ? [era.evidence[0]!] : [{ type: "commit", sha: commitSha }];

  return {
    id: `stop:outline:${era.id}:${suffix}`,
    narrative: `Placeholder stop for ${era.name}.`,
    evidence,
    drillTarget: {
      eraId: era.id,
      commitSha,
    },
  };
}

function groupToChapter(group: EraGroup, order: number, title?: string): TourChapter {
  const primaryEra = group.eras[0]!;
  const chapterTitle =
    title ??
    (group.eras.length === 1
      ? primaryEra.name
      : `${primaryEra.name} → ${group.eras[group.eras.length - 1]!.name}`);

  const summary =
    group.eras.length === 1
      ? primaryEra.summary
      : group.eras.map((era) => era.summary).join(" ").slice(0, 300);

  return {
    order,
    title: chapterTitle,
    summary,
    eraIds: group.eraIds,
    stops: [placeholderStop(primaryEra, String(order))],
  };
}

function erasToGroups(eras: NamedEra[]): EraGroup[] {
  return [...eras]
    .sort((left, right) => left.startAt - right.startAt)
    .map((era) => ({
      eraIds: [era.id],
      eras: [era],
      startAt: era.startAt,
      endAt: era.endAt,
    }));
}

function mergeAdjacentSmallest(groups: EraGroup[]): EraGroup[] {
  if (groups.length <= 1) {
    return groups;
  }

  let smallestIndex = 0;
  let smallestSpan = Number.POSITIVE_INFINITY;

  for (let index = 0; index < groups.length - 1; index += 1) {
    const left = groups[index]!;
    const right = groups[index + 1]!;
    const combinedSpan = right.endAt - left.startAt;
    if (combinedSpan < smallestSpan) {
      smallestSpan = combinedSpan;
      smallestIndex = index;
    }
  }

  const left = groups[smallestIndex]!;
  const right = groups[smallestIndex + 1]!;
  const merged: EraGroup = {
    eraIds: [...left.eraIds, ...right.eraIds],
    eras: [...left.eras, ...right.eras],
    startAt: left.startAt,
    endAt: right.endAt,
  };

  return [
    ...groups.slice(0, smallestIndex),
    merged,
    ...groups.slice(smallestIndex + 2),
  ];
}

function splitLargestGroup(groups: EraGroup[]): EraGroup[] {
  if (groups.length === 0) {
    return groups;
  }

  let largestIndex = 0;
  let largestSpan = -1;

  for (let index = 0; index < groups.length; index += 1) {
    const span = eraSpan(groups[index]!);
    if (span > largestSpan) {
      largestSpan = span;
      largestIndex = index;
    }
  }

  const target = groups[largestIndex]!;
  const era = target.eras[0]!;

  const overviewGroup: EraGroup = {
    eraIds: [era.id],
    eras: [era],
    startAt: target.startAt,
    endAt: target.endAt,
  };

  const deepDiveGroup: EraGroup = {
    eraIds: [era.id],
    eras: [era],
    startAt: target.startAt,
    endAt: target.endAt,
  };

  const claimTitle =
    era.claims[1]?.text ?? era.claims[0]?.text ?? `${era.name} deep dive`;

  return [
    ...groups.slice(0, largestIndex),
    overviewGroup,
    {
      ...deepDiveGroup,
      eras: [
        {
          ...era,
          name: claimTitle.length <= 80 ? claimTitle : `${era.name} deep dive`,
        },
      ],
    },
    ...groups.slice(largestIndex + 1),
  ];
}

function normalizeGroups(groups: EraGroup[]): EraGroup[] {
  let normalized = [...groups];

  while (normalized.length > MAX_CHAPTERS) {
    normalized = mergeAdjacentSmallest(normalized);
  }

  while (normalized.length < MIN_CHAPTERS) {
    normalized = splitLargestGroup(normalized);
  }

  return normalized;
}

export function outlineDefaultTourChapters(artifact: ErasArtifact): TourChapter[] {
  const groups = normalizeGroups(erasToGroups(artifact.eras));

  return groups.map((group, index) => {
    if (group.eras.length === 1 && group.eras[0]!.name.includes("deep dive")) {
      return groupToChapter(group, index + 1, `${group.eras[0]!.name}`);
    }

    if (group.eras.length === 1 && index > 0 && groups[index - 1]?.eraIds[0] === group.eraIds[0]) {
      const era = group.eras[0]!;
      return groupToChapter(group, index + 1, `${era.name} overview`);
    }

    return groupToChapter(group, index + 1);
  });
}

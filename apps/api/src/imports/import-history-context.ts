export type ImportHistoryCampaignLink = {
  batchId: string;
  campaignId: string | null;
  campaignName: string | null;
  state: 'CURRENT' | 'DELETED';
};

export function attachImportCampaignContext<T extends { id: string }>(
  batches: readonly T[],
  links: readonly ImportHistoryCampaignLink[],
) {
  const linksByBatch = new Map<string, ImportHistoryCampaignLink[]>();
  for (const link of links) {
    if (!link.campaignId) continue;
    const batchLinks = linksByBatch.get(link.batchId) ?? [];
    batchLinks.push(link);
    linksByBatch.set(link.batchId, batchLinks);
  }

  return batches.map((batch) => {
    const batchLinks = linksByBatch.get(batch.id) ?? [];
    return {
      ...batch,
      currentCampaignNames: [
        ...new Set(
          batchLinks
            .filter(
              (link) => link.state === 'CURRENT' && link.campaignName !== null,
            )
            .map((link) => link.campaignName!),
        ),
      ],
      deletedCampaignCount: new Set(
        batchLinks
          .filter((link) => link.state === 'DELETED')
          .map((link) => link.campaignId),
      ).size,
    };
  });
}

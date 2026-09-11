export const formatHTG = (n) => {
  if (n === undefined || n === null || isNaN(n)) return "0 HTG";
  return `${Number(n).toLocaleString("fr-HT", { maximumFractionDigits: 2 })} HTG`;
};

export const STATUS_LABEL = {
  pending: { label: "En attente", cls: "status-pending", emoji: "🟡" },
  approved: { label: "Approuvée", cls: "status-approved", emoji: "🟢" },
  rejected: { label: "Rejetée", cls: "status-rejected", emoji: "🔴" },
  completed: { label: "Terminée", cls: "status-completed", emoji: "🔵" },
};

export const formatDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("fr-HT", { dateStyle: "short", timeStyle: "short" });
};

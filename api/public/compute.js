module.exports = (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ code: 'METHOD_NOT_ALLOWED', message: 'Only POST allowed.' });
  }

  const {
    decision,
    pros = [],
    cons = [],
    diff_threshold = 10,
    top_n = 3,
    low_confidence_threshold = 2,
  } = req.body || {};

  function scoreItems(items, side) {
    return items.map((item) => {
      const importance = Number(item.importance) || 0;
      const confidence = Number(item.confidence) || 0;
      const weighted = importance * confidence;
      return { ...item, side, importance, confidence, weighted };
    });
  }

  const prosScored = Array.isArray(pros) ? scoreItems(pros, 'pro') : [];
  const consScored = Array.isArray(cons) ? scoreItems(cons, 'con') : [];

  const pro_total = prosScored.reduce((sum, it) => sum + it.weighted, 0);
  const con_total = consScored.reduce((sum, it) => sum + it.weighted, 0);
  const diff = Math.abs(pro_total - con_total);
  const allScored = [...prosScored, ...consScored];
  const topSorted = [...allScored].sort((a, b) => b.weighted - a.weighted).slice(0, top_n);

  const needs_diff_verification = diff <= diff_threshold;
  const low_confidence_in_top = topSorted.some((it) => it.confidence <= low_confidence_threshold);

  const needs_verification = needs_diff_verification || low_confidence_in_top;
  const reasons = [];
  if (needs_diff_verification) reasons.push('条件A:差分が10点以内');
  if (low_confidence_in_top) reasons.push('条件B:上位項目に確度が低いものが含まれる');

  const response = {
    pros_scored: prosScored,
    cons_scored: consScored,
    totals: { pro_total, con_total, diff },
    top_items: topSorted,
    decision_gate: {
      needs_verification,
      reasons,
      flags: {
        diff_within_threshold: needs_diff_verification,
        low_confidence_in_top_items: low_confidence_in_top,
      },
      verification_targets: topSorted.filter((it) => it.confidence <= low_confidence_threshold).map((it) => it.item_id),
    },
  };

  return res.status(200).json(response);
};

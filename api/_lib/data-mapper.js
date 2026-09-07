function sourceToRow(source, ownerKey) {
  return {
    id: source.id,
    owner_key: ownerKey,
    title: source.title,
    type: source.type,
    author: source.author || "",
    color: source.color,
    created_at: source.createdAt,
    updated_at: source.updatedAt,
  };
}

function highlightToRow(highlight, ownerKey) {
  return {
    id: highlight.id,
    owner_key: ownerKey,
    source_id: highlight.sourceId,
    text: highlight.text,
    tags: highlight.tags || [],
    note: highlight.note || "",
    converted: Boolean(highlight.converted),
    created_at: highlight.createdAt,
  };
}

function conversionToRow(conversion, ownerKey) {
  return {
    id: conversion.id,
    owner_key: ownerKey,
    highlight_id: conversion.highlightId || null,
    source_id: conversion.sourceId || null,
    insight: conversion.insight || "",
    questions: conversion.questions || [],
    answers: conversion.answers || [],
    intention_full: conversion.intentionFull || "",
    intention_why: conversion.intentionWhy || "",
    created_at: conversion.createdAt,
  };
}

function sourceFromRow(row) {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    author: row.author || "",
    color: row.color,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function highlightFromRow(row) {
  return {
    id: row.id,
    sourceId: row.source_id,
    text: row.text,
    tags: Array.isArray(row.tags) ? row.tags : [],
    note: row.note || "",
    converted: Boolean(row.converted),
    createdAt: row.created_at,
  };
}

function conversionFromRow(row) {
  return {
    id: row.id,
    highlightId: row.highlight_id || null,
    sourceId: row.source_id || null,
    insight: row.insight || "",
    questions: Array.isArray(row.questions) ? row.questions : [],
    answers: Array.isArray(row.answers) ? row.answers : [],
    intentionFull: row.intention_full || "",
    intentionWhy: row.intention_why || "",
    createdAt: row.created_at,
  };
}

module.exports = {
  sourceToRow,
  highlightToRow,
  conversionToRow,
  sourceFromRow,
  highlightFromRow,
  conversionFromRow,
};

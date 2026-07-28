import assert from "node:assert/strict";
import test from "node:test";

const columns = [
  "Triage",
  "Refinement",
  "Awaiting Approval",
  "Ready",
  "In Development",
  "Review",
  "Done",
];

const allowedTransitions = new Map(
  columns.slice(0, -1).map((column, index) => [column, columns[index + 1]]),
);

function transition(task, nextColumn) {
  const expectedColumn = allowedTransitions.get(task.column);
  if (expectedColumn !== nextColumn) {
    throw new Error(
      `transition refusée: ${task.column} -> ${nextColumn}; attendu: ${expectedColumn ?? "aucune"}`,
    );
  }

  return { ...task, column: nextColumn };
}

test("parcourt toutes les colonnes du workflow dans l'ordre", () => {
  let task = { column: columns[0], labels: [] };

  for (const nextColumn of columns.slice(1)) {
    task = transition(task, nextColumn);
    assert.equal(task.column, nextColumn);
  }

  assert.equal(task.column, "Done");
});

test("la colonne est l'unique source de vérité de l'état", () => {
  const task = { column: "Ready", labels: ["unrelated:label"] };

  assert.equal(task.column, "Ready");
  assert.notEqual(task.labels[0], task.column);
  assert.equal(transition(task, "In Development").column, "In Development");
});

test("human:review reste absent pendant tout le parcours", () => {
  let task = { column: "Triage", labels: [] };

  for (const nextColumn of columns.slice(1)) {
    task = transition(task, nextColumn);
    assert.equal(task.labels.includes("human:review"), false);
  }
});

test("les transitions qui ne suivent pas la colonne courante sont refusées", () => {
  const invalidTransitions = [
    ["Triage", "Ready"],
    ["Refinement", "Done"],
    ["Awaiting Approval", "In Development"],
    ["Ready", "Review"],
    ["In Development", "Done"],
    ["Review", "Ready"],
    ["Done", "Triage"],
  ];

  for (const [currentColumn, nextColumn] of invalidTransitions) {
    assert.throws(
      () => transition({ column: currentColumn, labels: [] }, nextColumn),
      /transition refusée/,
      `${currentColumn} -> ${nextColumn} aurait dû être refusée`,
    );
  }
});

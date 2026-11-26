import assert from "node:assert/strict";
import test from "node:test";
import {
  BannerUploadPendingError,
  saveTournamentWithBanner,
} from "./tournamentSave.js";

test("banner retry uploads to the saved tournament without creating another", async () => {
  const calls = { create: 0, update: 0, upload: [] };
  const savedTournament = { id: "tournament-1", name: "ELEVN Cup" };
  let firstUpload = true;
  const dependencies = {
    create: async () => {
      calls.create += 1;
      return savedTournament;
    },
    update: async () => {
      calls.update += 1;
      return savedTournament;
    },
    upload: async (id) => {
      calls.upload.push(id);
      if (firstUpload) {
        firstUpload = false;
        throw new Error("storage unavailable");
      }
      return { ...savedTournament, bannerKey: "tournaments/key.png" };
    },
    payload: {},
    bannerFile: { name: "banner.png" },
    token: "test-token",
  };

  let pending;
  try {
    await saveTournamentWithBanner(dependencies);
  } catch (error) {
    pending = error;
  }
  assert.ok(pending instanceof BannerUploadPendingError);
  assert.equal(pending.tournament, savedTournament);

  const uploaded = await saveTournamentWithBanner({
    ...dependencies,
    retryTournamentId: pending.tournament.id,
  });

  assert.equal(uploaded.bannerKey, "tournaments/key.png");
  assert.deepEqual(calls, {
    create: 1,
    update: 0,
    upload: ["tournament-1", "tournament-1"],
  });
});

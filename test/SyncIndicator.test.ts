import assert from "assert";
import { describe, it } from "vitest";
import { getSyncIndicatorMachine } from '../src/os/explorer/components/SyncIndicator.js';
import { createActor } from "xstate";

const CONNECTION_INIT_TIMEOUT = 100;
const MAX_SYNC_MESSAGE_DELAY = 100;

function getSyncIndicatorService() {
  return createActor(
    getSyncIndicatorMachine({
      connectionInitTimeout: CONNECTION_INIT_TIMEOUT,
      maxSyncMessageDelay: MAX_SYNC_MESSAGE_DELAY,
    })
  ).start();
}

describe("SyncIndicator", () => {
  describe("syncIndicatorMachine Tests", () => {
    it("should start in initial state", () => {
      const service = getSyncIndicatorService();
      const state = service.getSnapshot();
      assert(state.matches("internet.disconnected"));
      assert(state.matches("sync.unknown"));
      assert(state.matches("syncServer.disconnected"));

      service.stop();
    });

    it("should switch between internet.connected and internet.disconnect", () => {
      const service = getSyncIndicatorService();

      service.send({ type: "INTERNET_CONNECTED" });

      let state = service.getSnapshot();
      assert(state.matches("internet.connected"));
      assert(state.matches("sync.unknown"));
      assert(state.matches("syncServer.disconnected"));

      service.send({ type: "INTERNET_DISCONNECTED" });

      state = service.getSnapshot();
      assert(state.matches("internet.disconnected"));
      assert(state.matches("sync.unknown"));
      assert(state.matches("syncServer.disconnected"));

      service.stop();
    });

    it("should switch between syncServer.connected and syncServer.disconnect", () => {
      const service = getSyncIndicatorService();

      service.send({ type: "SYNC_SERVER_CONNECTED" });

      let state = service.getSnapshot();
      assert(state.matches("internet.disconnected"));
      assert(state.matches("sync.unknown"));
      assert(state.matches("syncServer.connected"));

      service.send({ type: "SYNC_SERVER_DISCONNECTED" });

      state = service.getSnapshot();
      assert(state.matches("internet.disconnected"));
      assert(state.matches("sync.unknown"));
      assert(state.matches("syncServer.disconnected"));

      service.stop();
    });

    it("should switch to syncServer error state if sync server hasn't connected after conection init timeout", async () => {
      const service = getSyncIndicatorService();

      service.send({ type: "INTERNET_CONNECTED" });

      let state = service.getSnapshot();
      assert(state.matches("internet.connected"));
      assert(state.matches("sync.unknown"));
      assert(state.matches("syncServer.disconnected.ok"));

      await pause(CONNECTION_INIT_TIMEOUT + 1);

      state = service.getSnapshot();

      assert(state.matches("internet.connected"));
      assert(state.matches("sync.unknown"));
      assert(state.matches("syncServer.disconnected.error"));

      service.stop();
    });

    it("should switch between inSync and outOfSync", async () => {
      const service = getSyncIndicatorService();

      service.send({ type: "INTERNET_CONNECTED" });
      service.send({ type: "SYNC_SERVER_CONNECTED" });
      service.send({ type: "IS_IN_SYNC" });

      let state = service.getSnapshot();
      assert(state.matches("internet.connected"));
      assert(state.matches("sync.inSync"));
      assert(state.matches("syncServer.connected"));

      service.send({ type: "IS_OUT_OF_SYNC" });

      state = service.getSnapshot();
      assert(state.matches("internet.connected"));
      assert(state.matches("sync.outOfSync"));
      assert(state.matches("syncServer.connected"));

      service.stop();
    });

    it("should switch to sync error state if we are out of sync, connected to sync server and haven't received a message in a while", async () => {
      const service = getSyncIndicatorService();

      service.send({ type: "INTERNET_CONNECTED" });
      service.send({ type: "SYNC_SERVER_CONNECTED" });
      service.send({ type: "IS_OUT_OF_SYNC" });

      let state = service.getSnapshot();
      assert(state.matches("internet.connected"));
      assert(state.matches("sync.outOfSync.ok"));
      assert(state.matches("syncServer.connected"));

      await pause(CONNECTION_INIT_TIMEOUT + MAX_SYNC_MESSAGE_DELAY + 10);

      state = service.getSnapshot();
      assert(state.matches("internet.connected"));
      assert(state.matches("sync.outOfSync.error"));
      assert(state.matches("syncServer.connected"));

      service.stop();
    });

    it("should not switch into sync error state if we are offline, only once we go online and recive no sync messages", async () => {
      const service = getSyncIndicatorService();

      service.send({ type: "IS_OUT_OF_SYNC" });

      let state = service.getSnapshot();
      assert(state.matches("internet.disconnected"));
      assert(state.matches("sync.outOfSync.ok"));
      assert(state.matches("syncServer.disconnected"));

      await pause(MAX_SYNC_MESSAGE_DELAY + 10);

      state = service.getSnapshot();
      assert(state.matches("internet.disconnected"));
      assert(state.matches("sync.outOfSync.ok"));
      assert(state.matches("syncServer.disconnected"));

      service.send({ type: "INTERNET_CONNECTED" });

      await pause(CONNECTION_INIT_TIMEOUT + MAX_SYNC_MESSAGE_DELAY + 10);

      state = service.getSnapshot();
      assert(state.matches("internet.connected"));
      assert(state.matches("sync.outOfSync.error"));
      assert(state.matches("syncServer.disconnected"));

      service.stop();
    });

    it("should not switch into sync error state if we are out of sync but are still regularly receiving sync messages ", async () => {
      const service = getSyncIndicatorService();

      service.send({ type: "INTERNET_CONNECTED" });
      service.send({ type: "SYNC_SERVER_CONNECTED" });
      service.send({ type: "IS_OUT_OF_SYNC" });

      let state = service.getSnapshot();

      assert(state.matches("internet.connected"));
      assert(state.matches("sync.outOfSync.ok"));
      assert(state.matches("syncServer.connected"));

      service.send({ type: "RECEIVED_SYNC_MESSAGE" });
      await pause(MAX_SYNC_MESSAGE_DELAY / 2);

      service.send({ type: "RECEIVED_SYNC_MESSAGE" });
      await pause(MAX_SYNC_MESSAGE_DELAY / 2);

      service.send({ type: "RECEIVED_SYNC_MESSAGE" });
      await pause(MAX_SYNC_MESSAGE_DELAY / 2);

      state = service.getSnapshot();
      assert(state.matches("internet.connected"));
      assert(state.matches("sync.outOfSync.ok"));
      assert(state.matches("syncServer.connected"));

      service.stop();
    });

    it("should not switch into syncServer error state if the sync server disconnects ", async () => {
      const service = getSyncIndicatorService();

      service.send({ type: "INTERNET_CONNECTED" });
      service.send({ type: "SYNC_SERVER_CONNECTED" });
      service.send({ type: "IS_OUT_OF_SYNC" });

      let state = service.getSnapshot();

      assert(state.matches("internet.connected"));
      assert(state.matches("sync.outOfSync.ok"));
      assert(state.matches("syncServer.connected"));

      service.send({ type: "SYNC_SERVER_DISCONNECTED" });

      state = service.getSnapshot();
      assert(state.matches("internet.connected"));
      assert(state.matches("sync.outOfSync.ok"));
      assert(state.matches("syncServer.disconnected.error"));

      service.stop();
    });
  });
});

function pause(t = 0) {
  return new Promise<void>((resolve) => setTimeout(() => resolve(), t));
}

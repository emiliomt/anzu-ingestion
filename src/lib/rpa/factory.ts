// Anzu Dynamics — RPA Connector Factory
// Returns the right ERP connector for a given erpType.
// Unknown or demo types fall back to MockErpConnector (safe for demos/CI).

import type { ErpCredentialData } from "@/lib/vault";
import type { BaseErpConnector } from "./base-connector";

export type ErpType = "sinco" | "siigo" | "sap_b1" | "contpaq" | "mock" | "demo" | string;

export function createErpConnector(
  erpType: ErpType,
  credentials: ErpCredentialData
): BaseErpConnector {
  switch (erpType) {
    case "sinco": {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { SincoConnector } = require("./sinco/connector") as typeof import("./sinco/connector");
      return new SincoConnector(credentials);
    }
    case "siigo": {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { SiigoConnector } = require("./siigo/connector") as typeof import("./siigo/connector");
      return new SiigoConnector(credentials);
    }
    case "mock":
    case "demo": {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { MockErpConnector } = require("./mock/connector") as typeof import("./mock/connector");
      return new MockErpConnector(credentials);
    }
    default: {
      // Unrecognised ERP type — fall back to mock with a warning
      console.warn(
        `[rpa-factory] Unknown erpType "${erpType}" — falling back to MockErpConnector`
      );
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { MockErpConnector } = require("./mock/connector") as typeof import("./mock/connector");
      return new MockErpConnector(credentials);
    }
  }
}

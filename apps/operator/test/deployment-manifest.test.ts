import { describe, expect, test } from "bun:test";
import type { Address } from "viem";

import {
  type DeploymentManifest,
  parseDeploymentManifest,
} from "../src/deployment-manifest.ts";
import { SUPPORTED_DEPLOYMENT } from "../src/supported-deployment.ts";

type DeepMutable<Value> =
  Value extends ReadonlyArray<infer Item>
    ? DeepMutable<Item>[]
    : Value extends object
      ? { -readonly [Key in keyof Value]: DeepMutable<Value[Key]> }
      : Value;

function mutableManifest(): DeepMutable<DeploymentManifest> {
  return structuredClone(
    SUPPORTED_DEPLOYMENT,
  ) as DeepMutable<DeploymentManifest>;
}

describe("supported deployment manifest", () => {
  test("pins the verified Base deployment and independent capability states", () => {
    expect(SUPPORTED_DEPLOYMENT.core.chain).toEqual({ id: 8453, name: "Base" });
    expect(SUPPORTED_DEPLOYMENT.verification.finality).toBe("finalized");
    expect(SUPPORTED_DEPLOYMENT.core.game.proxy.address).toBe(
      "0xf397910F005151b09644228573a4353818D3755d",
    );
    expect(SUPPORTED_DEPLOYMENT.core.game.implementation.address).toBe(
      "0xffC01680Ae10698eCF14aFFD63da195366d65873",
    );
    expect(SUPPORTED_DEPLOYMENT.capabilities.resourceTokens.status).toBe(
      "supported",
    );
    expect(SUPPORTED_DEPLOYMENT.capabilities.rift.status).toBe("disabled");
    expect(SUPPORTED_DEPLOYMENT.capabilities.market.status).toBe("disabled");
  });

  test("deep-freezes every parsed object and array", () => {
    expect(Object.isFrozen(SUPPORTED_DEPLOYMENT)).toBe(true);
    expect(Object.isFrozen(SUPPORTED_DEPLOYMENT.core)).toBe(true);
    expect(Object.isFrozen(SUPPORTED_DEPLOYMENT.core.game.proxy)).toBe(true);

    const resourceTokens = SUPPORTED_DEPLOYMENT.capabilities.resourceTokens;
    expect(resourceTokens.status).toBe("supported");
    if (resourceTokens.status === "supported") {
      expect(Object.isFrozen(resourceTokens.evidence)).toBe(true);
      expect(Object.isFrozen(resourceTokens.tokens)).toBe(true);
    }
  });

  test("normalizes valid EVM addresses to their checksummed form", () => {
    const candidate = mutableManifest();
    candidate.core.game.proxy.address =
      SUPPORTED_DEPLOYMENT.core.game.proxy.address.toLowerCase() as Address;

    const parsed = parseDeploymentManifest(candidate);

    expect(parsed.core.game.proxy.address).toBe(
      SUPPORTED_DEPLOYMENT.core.game.proxy.address,
    );
  });

  test("rejects unknown fields at every trust boundary", () => {
    const candidate = mutableManifest();
    const proxyWithUnknownField = candidate.core.game
      .proxy as typeof candidate.core.game.proxy & {
      unreviewed: boolean;
    };
    proxyWithUnknownField.unreviewed = true;

    expect(() => parseDeploymentManifest(candidate)).toThrow();
  });

  test.each([
    [
      "short Git commit",
      () => {
        const candidate = mutableManifest();
        candidate.core.deployment.commit = "701bed3";
        return candidate;
      },
    ],
    [
      "noncanonical hash",
      () => {
        const candidate = mutableManifest();
        candidate.core.game.proxy.codeKeccak256 = `0x${"A".repeat(64)}`;
        return candidate;
      },
    ],
    [
      "invalid address",
      () => {
        const candidate = mutableManifest();
        candidate.core.game.proxy.address = "0x1234";
        return candidate;
      },
    ],
    [
      "mismatched deployment provenance",
      () => {
        const candidate = mutableManifest();
        candidate.provenance.deploymentArtifactCommit = "0".repeat(40);
        return candidate;
      },
    ],
    [
      "verification before its block",
      () => {
        const candidate = mutableManifest();
        candidate.verifiedAt = "2026-08-04T15:24:42.000Z";
        return candidate;
      },
    ],
    [
      "a nonstandard implementation slot",
      () => {
        const candidate = mutableManifest();
        const implementation = candidate.core.game
          .implementation as unknown as { eip1967Slot: string };
        implementation.eip1967Slot = `0x${"0".repeat(64)}`;
        return candidate;
      },
    ],
    [
      "duplicated resource-token evidence",
      () => {
        const candidate = mutableManifest();
        const resourceTokens = candidate.capabilities.resourceTokens;
        if (resourceTokens.status !== "supported") {
          throw new Error(
            "Expected the supported manifest to include resource tokens",
          );
        }
        resourceTokens.evidence = [
          "runtime-config",
          "runtime-config",
          "base-rpc-call",
        ];
        return candidate;
      },
    ],
    [
      "mismatched stats provenance",
      () => {
        const candidate = mutableManifest();
        candidate.provenance.statsSurface.canonicalUrl =
          "https://example.com/stats";
        return candidate;
      },
    ],
    [
      "a traversing research-note path",
      () => {
        const candidate = mutableManifest();
        const whitepaper = candidate.provenance.whitepaper as unknown as {
          researchNote: string;
        };
        whitepaper.researchNote = "docs/../../outside.md";
        return candidate;
      },
    ],
  ])("rejects %s", (_label, createCandidate) => {
    expect(() => parseDeploymentManifest(createCandidate())).toThrow();
  });

  test("allows score-only operation to describe every optional capability as disabled", () => {
    const candidate = mutableManifest();
    candidate.capabilities.resourceTokens = {
      status: "disabled",
      reason: "Live token identity is unavailable.",
    };

    const parsed = parseDeploymentManifest(candidate);

    expect(parsed.capabilities.resourceTokens.status).toBe("disabled");
    expect(parsed.core.game.proxy.address).toBe(
      SUPPORTED_DEPLOYMENT.core.game.proxy.address,
    );
  });

  test("rejects duplicated optional contract identities", () => {
    const candidate = mutableManifest();
    const resourceTokens = candidate.capabilities.resourceTokens;
    expect(resourceTokens.status).toBe("supported");
    if (resourceTokens.status !== "supported") {
      throw new Error(
        "Expected the supported manifest to include resource tokens",
      );
    }
    resourceTokens.tokens.crystal.proxy.address =
      resourceTokens.tokens.metal.proxy.address;

    expect(() => parseDeploymentManifest(candidate)).toThrow();
  });
});

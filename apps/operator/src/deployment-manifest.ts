import type { Address } from "viem";
import { getAddress, isAddress } from "viem";
import { z } from "zod";

type Primitive = bigint | boolean | null | number | string | symbol | undefined;

export const EIP1967_IMPLEMENTATION_SLOT =
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc" as const;

export type DeepReadonly<Value> = Value extends Primitive
  ? Value
  : Value extends ReadonlyArray<infer Item>
    ? ReadonlyArray<DeepReadonly<Item>>
    : { readonly [Key in keyof Value]: DeepReadonly<Value[Key]> };

const gitCommitSchema = z
  .string()
  .regex(/^[0-9a-f]{40}$/, "must be a lowercase, full Git commit SHA");

const sha256Schema = z
  .string()
  .regex(/^sha256:[0-9a-f]{64}$/, "must be a lowercase sha256 digest");

const keccak256Schema = z
  .string()
  .regex(/^0x[0-9a-f]{64}$/, "must be a lowercase 32-byte hex digest");

const eip1967ImplementationSlotSchema = z.literal(EIP1967_IMPLEMENTATION_SLOT);

const decimalIntegerSchema = z
  .string()
  .regex(/^(0|[1-9][0-9]*)$/, "must be a canonical non-negative integer");

const positiveDecimalIntegerSchema = decimalIntegerSchema.refine(
  (value) => BigInt(value) > 0n,
  "must be greater than zero",
);

const isoTimestampSchema = z.string().refine((value) => {
  try {
    return new Date(value).toISOString() === value;
  } catch {
    return false;
  }
}, "must be a canonical ISO-8601 timestamp");

const httpsUrlSchema = z
  .string()
  .url()
  .refine((value) => {
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  }, "must use HTTPS");

const evmAddressSchema = z
  .string()
  .refine((value) => isAddress(value), "must be a valid EVM address")
  .transform((value): Address => getAddress(value));

const contractCodeIdentitySchema = z.strictObject({
  address: evmAddressSchema,
  codeBytes: z.number().int().positive(),
  codeKeccak256: keccak256Schema,
});

const verificationBlockSchema = z.strictObject({
  number: positiveDecimalIntegerSchema,
  hash: keccak256Schema,
  timestamp: isoTimestampSchema,
});

const disabledCapabilitySchema = z.strictObject({
  status: z.literal("disabled"),
  reason: z.string().trim().min(1),
});

const resourceTokenSchema = z.strictObject({
  symbol: z.string().trim().min(1),
  decimals: z.number().int().min(0).max(255),
  proxy: contractCodeIdentitySchema,
  implementation: contractCodeIdentitySchema.extend({
    eip1967Slot: eip1967ImplementationSlotSchema,
  }),
});

const supportedResourceTokensSchema = z.strictObject({
  status: z.literal("supported"),
  evidence: z.tuple([
    z.literal("runtime-config"),
    z.literal("base-rpc-code"),
    z.literal("base-rpc-call"),
  ]),
  tokens: z.strictObject({
    metal: resourceTokenSchema,
    crystal: resourceTokenSchema,
    deuterium: resourceTokenSchema,
  }),
});

export const deploymentManifestSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    manifestId: z
      .string()
      .regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/, "must be a stable identifier"),
    verifiedAt: isoTimestampSchema,
    verification: z.strictObject({
      finality: z.literal("finalized"),
      block: verificationBlockSchema,
      rpcUrl: httpsUrlSchema,
    }),
    core: z.strictObject({
      chain: z.strictObject({
        id: z.number().int().positive(),
        name: z.string().trim().min(1),
      }),
      game: z.strictObject({
        proxy: contractCodeIdentitySchema,
        implementation: contractCodeIdentitySchema.extend({
          eip1967Slot: eip1967ImplementationSlotSchema,
        }),
      }),
      deployment: z.strictObject({
        commit: gitCommitSchema,
        timestamp: isoTimestampSchema,
        abiSha256: sha256Schema,
      }),
      backend: z.strictObject({
        buildCommit: gitCommitSchema,
        buildCommitSource: z.string().trim().min(1),
      }),
      surfaces: z.strictObject({
        apiUrl: httpsUrlSchema,
        runtimeConfigUrl: httpsUrlSchema,
        healthUrl: httpsUrlSchema,
        graphqlUrl: httpsUrlSchema,
        statsUrl: httpsUrlSchema,
      }),
    }),
    capabilities: z.strictObject({
      rift: disabledCapabilitySchema,
      resourceTokens: z.discriminatedUnion("status", [
        disabledCapabilitySchema,
        supportedResourceTokensSchema,
      ]),
      market: disabledCapabilitySchema,
    }),
    provenance: z.strictObject({
      upstreamRepository: httpsUrlSchema,
      upstreamResearchCommit: gitCommitSchema,
      deploymentArtifactCommit: gitCommitSchema,
      statsSurface: z.strictObject({
        canonicalUrl: httpsUrlSchema,
        sourceCommit: gitCommitSchema,
        sourcePath: z.literal("apps/stats/index.html"),
      }),
      whitepaper: z.strictObject({
        version: z.string().trim().min(1),
        sha256: sha256Schema,
        researchNote: z.literal("docs/research/veydrift-whitepaper.md"),
      }),
    }),
  })
  .superRefine((manifest, context) => {
    if (
      manifest.core.game.proxy.address ===
      manifest.core.game.implementation.address
    ) {
      context.addIssue({
        code: "custom",
        path: ["core", "game", "implementation", "address"],
        message: "must differ from the proxy address",
      });
    }

    if (
      manifest.core.deployment.commit !==
      manifest.provenance.deploymentArtifactCommit
    ) {
      context.addIssue({
        code: "custom",
        path: ["provenance", "deploymentArtifactCommit"],
        message: "must match the core deployment commit",
      });
    }

    if (
      manifest.core.surfaces.statsUrl !==
      manifest.provenance.statsSurface.canonicalUrl
    ) {
      context.addIssue({
        code: "custom",
        path: ["provenance", "statsSurface", "canonicalUrl"],
        message: "must match the pinned stats surface",
      });
    }

    if (
      new Date(manifest.verifiedAt) <
      new Date(manifest.verification.block.timestamp)
    ) {
      context.addIssue({
        code: "custom",
        path: ["verifiedAt"],
        message: "cannot precede the verification block timestamp",
      });
    }

    const { apiUrl, graphqlUrl, healthUrl, runtimeConfigUrl } =
      manifest.core.surfaces;
    if (runtimeConfigUrl !== `${apiUrl}/runtime-config`) {
      context.addIssue({
        code: "custom",
        path: ["core", "surfaces", "runtimeConfigUrl"],
        message: "must be the API runtime-config endpoint",
      });
    }
    if (healthUrl !== `${apiUrl}/health`) {
      context.addIssue({
        code: "custom",
        path: ["core", "surfaces", "healthUrl"],
        message: "must be the API health endpoint",
      });
    }
    if (graphqlUrl !== `${apiUrl}/graphql`) {
      context.addIssue({
        code: "custom",
        path: ["core", "surfaces", "graphqlUrl"],
        message: "must be the API GraphQL endpoint",
      });
    }

    if (manifest.capabilities.resourceTokens.status === "supported") {
      const tokens = Object.values(manifest.capabilities.resourceTokens.tokens);
      const proxyAddresses = tokens.map((token) => token.proxy.address);
      const implementationAddresses = tokens.map(
        (token) => token.implementation.address,
      );
      if (new Set(proxyAddresses).size !== proxyAddresses.length) {
        context.addIssue({
          code: "custom",
          path: ["capabilities", "resourceTokens", "tokens"],
          message: "token proxy addresses must be distinct",
        });
      }
      if (
        new Set(implementationAddresses).size !== implementationAddresses.length
      ) {
        context.addIssue({
          code: "custom",
          path: ["capabilities", "resourceTokens", "tokens"],
          message: "token implementation addresses must be distinct",
        });
      }
      for (const token of tokens) {
        if (token.proxy.address === token.implementation.address) {
          context.addIssue({
            code: "custom",
            path: ["capabilities", "resourceTokens", "tokens"],
            message: "a token implementation must differ from its proxy",
          });
        }
      }

      const tokenAddresses = [...proxyAddresses, ...implementationAddresses];
      if (
        tokenAddresses.includes(manifest.core.game.proxy.address) ||
        tokenAddresses.includes(manifest.core.game.implementation.address)
      ) {
        context.addIssue({
          code: "custom",
          path: ["capabilities", "resourceTokens", "tokens"],
          message: "token addresses must not reuse a core game address",
        });
      }
    }
  });

type ParsedDeploymentManifest = z.infer<typeof deploymentManifestSchema>;

export type DeploymentManifest = DeepReadonly<ParsedDeploymentManifest>;

export function parseDeploymentManifest(input: unknown): DeploymentManifest {
  return deepFreeze(deploymentManifestSchema.parse(input));
}

function deepFreeze<Value>(value: Value): DeepReadonly<Value> {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value as DeepReadonly<Value>;
  }

  for (const property of Reflect.ownKeys(value)) {
    deepFreeze((value as Record<PropertyKey, unknown>)[property]);
  }

  return Object.freeze(value) as DeepReadonly<Value>;
}

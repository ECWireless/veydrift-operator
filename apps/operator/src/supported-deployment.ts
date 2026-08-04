import { parseDeploymentManifest } from "./deployment-manifest.ts";

export const SUPPORTED_DEPLOYMENT = parseDeploymentManifest({
  schemaVersion: 1,
  manifestId: "base-mainnet.701bed3578cf",
  verifiedAt: "2026-08-04T15:45:09.000Z",
  verification: {
    finality: "finalized",
    block: {
      number: "49533868",
      hash: "0x0f19fea69ce7686b52407114a0b4253d397e67286da6e23f1e5ed1d3482e87c8",
      timestamp: "2026-08-04T15:24:43.000Z",
    },
    rpcUrl: "https://mainnet.base.org",
  },
  core: {
    chain: {
      id: 8453,
      name: "Base",
    },
    game: {
      proxy: {
        address: "0xf397910F005151b09644228573a4353818D3755d",
        codeBytes: 699,
        codeKeccak256:
          "0x76789f4e7481d8a251696c9eba3455948b667ce4336893d57b20bc3e7f044134",
      },
      implementation: {
        address: "0xffC01680Ae10698eCF14aFFD63da195366d65873",
        codeBytes: 24575,
        codeKeccak256:
          "0x34a7ba60fe11ddf74c09afa3387902c2a37541bf12aca0205c275ad45a2dd1c5",
        eip1967Slot:
          "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc",
      },
    },
    deployment: {
      commit: "701bed3578cff4d134657c714c599dbdb55a4b6a",
      timestamp: "2026-07-28T17:56:35.000Z",
      abiSha256:
        "sha256:62cdedb794d4aa11cce1e9ef61e26f12227ce40a3bf47dd6156db6dc5676bc99",
    },
    backend: {
      buildCommit: "30d904defb684f528cbefc55ac14f87b0cce3331",
      buildCommitSource: "VEYDRIFT_BUILD_ARTIFACT",
    },
    surfaces: {
      apiUrl: "https://api.veydrift.com",
      runtimeConfigUrl: "https://api.veydrift.com/runtime-config",
      healthUrl: "https://api.veydrift.com/health",
      graphqlUrl: "https://api.veydrift.com/graphql",
      statsUrl: "https://stats.veydrift.com/",
    },
  },
  capabilities: {
    rift: {
      status: "disabled",
      reason:
        "Unit 3 records Rift as deployment context only; enable it after a dedicated read adapter validates live selectors and state semantics.",
    },
    resourceTokens: {
      status: "supported",
      evidence: ["runtime-config", "base-rpc-code", "base-rpc-call"],
      tokens: {
        metal: {
          symbol: "vMETAL",
          decimals: 6,
          proxy: {
            address: "0x91A4f8A9D05F21E010dc1eE0B17Ab644D433cB41",
            codeBytes: 76,
            codeKeccak256:
              "0x46a010df31eb642b47284650e80051e8f6239a0c995003d230b437810bc4b9b4",
          },
          implementation: {
            address: "0x0EB302B53783cD8E2aCB551e53E4490B14327E31",
            codeBytes: 4677,
            codeKeccak256:
              "0x70a0f3fdec66550e00acc89c10962286edb30bf32b2690c72d8548a3a17b3bca",
            eip1967Slot:
              "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc",
          },
        },
        crystal: {
          symbol: "vCRYSTAL",
          decimals: 6,
          proxy: {
            address: "0xC6881a2C4C50E28AdCaC4D5577cD8e211E806B76",
            codeBytes: 76,
            codeKeccak256:
              "0x46a010df31eb642b47284650e80051e8f6239a0c995003d230b437810bc4b9b4",
          },
          implementation: {
            address: "0x7E81dc1191C3f910C31c919379d76fF737F1a205",
            codeBytes: 4681,
            codeKeccak256:
              "0x78bdf51d5d5e1607ab708c45508032e2c86c3fe4a41c18a37982cd9952a384fd",
            eip1967Slot:
              "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc",
          },
        },
        deuterium: {
          symbol: "vDEUT",
          decimals: 6,
          proxy: {
            address: "0x5A6027DE1C7E52B4b1AD0c13c3eC3Ad5FCb481e2",
            codeBytes: 76,
            codeKeccak256:
              "0x46a010df31eb642b47284650e80051e8f6239a0c995003d230b437810bc4b9b4",
          },
          implementation: {
            address: "0x7070702A4CD50bb477B6aDc11EF28869a1116a11",
            codeBytes: 4680,
            codeKeccak256:
              "0x4ca982ec1cb623f97207f3fc46af710754ec1cd84e7b44183e879f8fc8128fd2",
            eip1967Slot:
              "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc",
          },
        },
      },
    },
    market: {
      status: "disabled",
      reason:
        "The production runtime exposes no verified market contract surface; upstream token and CCA work is not treated as live deployment identity.",
    },
  },
  provenance: {
    upstreamRepository: "https://github.com/Borodutch/veydrift",
    upstreamResearchCommit: "83d7b81511f996f22229c29710712d04cd1f0d87",
    deploymentArtifactCommit: "701bed3578cff4d134657c714c599dbdb55a4b6a",
    statsSurface: {
      canonicalUrl: "https://stats.veydrift.com/",
      sourceCommit: "30d904defb684f528cbefc55ac14f87b0cce3331",
      sourcePath: "apps/stats/index.html",
    },
    whitepaper: {
      version: "1.1 (July 2026)",
      sha256:
        "sha256:8df4752e969a78aea041483daba10ee1a0a86873021d28d991a3ba3364e6ffaf",
      researchNote: "docs/research/veydrift-whitepaper.md",
    },
  },
});

import "dotenv/config";
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const testnetRpc = process.env.ARBITRUM_SEPOLIA_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc";
const testnetChainId = process.env.ARBITRUM_SEPOLIA_CHAIN_ID
  ? Number(process.env.ARBITRUM_SEPOLIA_CHAIN_ID)
  : 421614;
const privateKeys = process.env.PRIVATE_KEYS
  ? process.env.PRIVATE_KEYS.split(",").map((key) => key.trim()).filter(Boolean)
  : process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : undefined;

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./.hardhat-cache",
    artifacts: "./artifacts",
  },
  networks: {
    arbitrumSepolia: {
      url: testnetRpc,
      chainId: testnetChainId,
      ...(privateKeys ? { accounts: privateKeys } : {}),
    },
  },
  mocha: { timeout: 60_000 },
};

export default config;

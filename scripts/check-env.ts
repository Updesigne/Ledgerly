import { ethers, network } from "hardhat";

async function main() {
  const chain = await ethers.provider.getNetwork();
  const signers = await ethers.getSigners();
  console.log(`Hardhat network: ${network.name}`);
  console.log(`Connected chain ID: ${chain.chainId}`);
  console.log(`Configured signers: ${signers.length}`);
  if (signers[0]) {
    console.log(`Signer[0]: ${signers[0].address}`);
    console.log(`Signer[0] balance: ${ethers.formatEther(await ethers.provider.getBalance(signers[0].address))}`);
  }
  if (process.env.EXPECTED_CHAIN_ID && chain.chainId !== BigInt(process.env.EXPECTED_CHAIN_ID)) {
    throw new Error(`Chain ID mismatch: expected ${process.env.EXPECTED_CHAIN_ID}, got ${chain.chainId}`);
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });

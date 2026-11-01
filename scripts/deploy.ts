import { ethers, network } from "hardhat";
import fs from "node:fs";
import path from "node:path";



async function main() {
  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error("No deployer signer. Configure a private key for this network.");

  const networkInfo = await ethers.provider.getNetwork();
  console.log(`Deploying to ${network.name} (chainId ${networkInfo.chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} native tokens`);

  const token = await (await ethers.getContractFactory("MockUSDC")).deploy();
  await token.waitForDeployment();
  const registry = await (await ethers.getContractFactory("InvoiceRegistry")).deploy();
  await registry.waitForDeployment();
  const pricing = await (await ethers.getContractFactory("PricingEngine")).deploy();
  await pricing.waitForDeployment();
  const capital = await (await ethers.getContractFactory("CapitalAccounts")).deploy(await token.getAddress());
  await capital.waitForDeployment();
  const coordinator = await (await ethers.getContractFactory("FundingCoordinator")).deploy(
    await token.getAddress(), await registry.getAddress(), await pricing.getAddress(), await capital.getAddress(),
  );
  await coordinator.waitForDeployment();

  console.log("Wiring coordinator permissions...");
  await (await registry.setCoordinator(await coordinator.getAddress())).wait();
  await (await capital.setCoordinator(await coordinator.getAddress())).wait();

  // Wire Chainlink CRE verifier permissions
  const verifierKey = process.env.CRE_ETH_PRIVATE_KEY || process.env.PRIVATE_KEY;
  const verifierAddress =
    process.env.CRE_VERIFIER_ADDRESS ||
    (verifierKey
      ? new ethers.Wallet(verifierKey.startsWith("0x") ? verifierKey : `0x${verifierKey}`).address
      : deployer.address);
  console.log(`Wiring Chainlink CRE verifier permissions to ${verifierAddress}...`);
  await (await registry.setVerifier(verifierAddress)).wait();

  const deployment = {
    network: network.name,
    chainId: networkInfo.chainId.toString(),
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      mockUSDC: await token.getAddress(),
      invoiceRegistry: await registry.getAddress(),
      pricingEngine: await pricing.getAddress(),
      capitalAccounts: await capital.getAddress(),
      fundingCoordinator: await coordinator.getAddress(),
      verifier: verifierAddress,
    },
  };
  const outputDir = path.join(process.cwd(), "deployments");
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `${network.name}.json`);
  fs.writeFileSync(outputPath, `${JSON.stringify(deployment, null, 2)}\n`, "utf8");
  console.log(`\nDeployment saved to ${path.relative(process.cwd(), outputPath)}`);
  console.log(JSON.stringify(deployment, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });

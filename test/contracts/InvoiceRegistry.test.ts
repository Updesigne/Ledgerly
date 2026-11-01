import { expect } from "chai";
import { ethers } from "hardhat";
import { deploySystem, createAssignedInvoice } from "../helpers/deploy";

describe("InvoiceRegistry", function () {
  it("records submitted invoice and blocks duplicate invoice keys", async function () {
    const s = await deploySystem();
    const key = ethers.keccak256(ethers.toUtf8Bytes("invoice-unique"));
    const debtor = ethers.keccak256(ethers.toUtf8Bytes("debtor"));
    const evidence = ethers.keccak256(ethers.toUtf8Bytes("evidence"));
    const block = await ethers.provider.getBlock("latest");
    const due = BigInt(block!.timestamp + 30 * 86400);
    await (await s.registry.connect(s.supplier).submitInvoice(key, debtor, evidence, s.usdc(1000), due)).wait();
    const id = await s.registry.invoiceKeyToId(key);
    const invoice = await s.registry.getInvoice(id);
    expect(invoice.supplier).to.equal(s.supplier.address);
    expect(invoice.faceValue).to.equal(s.usdc(1000));
    expect(invoice.status).to.equal(1n); // Submitted
    await expect(s.registry.connect(s.supplier).submitInvoice(key, debtor, evidence, s.usdc(1000), due))
      .to.be.revertedWithCustomError(s.registry, "DuplicateInvoice");
  });

  it("requires owner review and a recorded assignment before funding workflow", async function () {
    const s = await deploySystem();
    const { invoiceId } = await createAssignedInvoice(s);
    const invoice = await s.registry.getInvoice(invoiceId);
    expect(invoice.status).to.equal(3n); // Assigned
    expect(invoice.assignmentComplete).to.equal(true);
    await expect(s.registry.connect(s.outsider).reviewInvoice(invoiceId, true, 1))
      .to.be.revertedWithCustomError(s.registry, "Unauthorized");
  });

  it("rejects an invalid risk tier", async function () {
    const s = await deploySystem();
    const key = ethers.keccak256(ethers.toUtf8Bytes("bad-tier"));
    const debtor = ethers.keccak256(ethers.toUtf8Bytes("debtor"));
    const evidence = ethers.keccak256(ethers.toUtf8Bytes("evidence"));
    const block = await ethers.provider.getBlock("latest");
    await (await s.registry.connect(s.supplier).submitInvoice(key, debtor, evidence, s.usdc(100), BigInt(block!.timestamp + 10000))).wait();
    await expect(s.registry.reviewInvoice(1, true, 5)).to.be.revertedWithCustomError(s.registry, "InvalidInput");
  });

  it("allows designated CRE verifier to review invoices", async function () {
    const s = await deploySystem();
    const key = ethers.keccak256(ethers.toUtf8Bytes("cre-test-invoice"));
    const debtor = ethers.keccak256(ethers.toUtf8Bytes("debtor"));
    const evidence = ethers.keccak256(ethers.toUtf8Bytes("evidence"));
    const block = await ethers.provider.getBlock("latest");
    await (await s.registry.connect(s.supplier).submitInvoice(key, debtor, evidence, s.usdc(500), BigInt(block!.timestamp + 10000))).wait();

    // Outsider cannot review
    await expect(s.registry.connect(s.outsider).reviewInvoice(1, true, 2))
      .to.be.revertedWithCustomError(s.registry, "Unauthorized");

    // Owner sets verifier (e.g. Chainlink CRE Forwarder)
    await (await s.registry.setVerifier(s.outsider.address)).wait();
    expect(await s.registry.verifier()).to.equal(s.outsider.address);

    // Designated verifier can now review
    await (await s.registry.connect(s.outsider).reviewInvoice(1, true, 2)).wait();
    const invoice = await s.registry.getInvoice(1);
    expect(invoice.status).to.equal(2n); // Verified
    expect(invoice.riskTier).to.equal(2);
  });
});

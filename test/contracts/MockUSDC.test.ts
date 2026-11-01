import { expect } from "chai";
import { ethers } from "hardhat";

describe("MockUSDC", function () {
  it("has six decimals and allows the owner to mint test tokens", async function () {
    const [owner, user] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("MockUSDC");
    const token = await Token.deploy();
    await token.waitForDeployment();

    expect(await token.decimals()).to.equal(6);
    await expect(token.mint(user.address, 1_000_000n))
      .to.emit(token, "Transfer").withArgs(ethers.ZeroAddress, user.address, 1_000_000n);
    expect(await token.balanceOf(user.address)).to.equal(1_000_000n);
    await expect(token.connect(user).mint(user.address, 1n)).to.be.revertedWithCustomError(token, "Unauthorized");
    expect(owner.address).not.to.equal(ethers.ZeroAddress);
  });

  it("requires allowance for transferFrom", async function () {
    const [, user, spender] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("MockUSDC");
    const token = await Token.deploy();
    await token.waitForDeployment();
    await (await token.mint(user.address, 100n)).wait();
    await expect(token.connect(spender).transferFrom(user.address, spender.address, 10n))
      .to.be.revertedWithCustomError(token, "InsufficientAllowance");
  });
});

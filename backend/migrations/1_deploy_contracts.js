const EvidenceChainUser = artifacts.require("EvidenceChainUser");
const EvidenceChainCrime = artifacts.require("EvidenceChainCrime");
const EvidenceChainCase = artifacts.require("EvidenceChainCase");
const EvidenceChainEvidence = artifacts.require("EvidenceChainEvidence");

module.exports = async function (deployer) {
  // Deploy User contract first
  await deployer.deploy(EvidenceChainUser, { gas: 6721975 });
  const userInstance = await EvidenceChainUser.deployed();
  console.log(`✅ User contract deployed at: ${userInstance.address}`);

  // Deploy Crime contract with User contract address
  await deployer.deploy(EvidenceChainCrime, userInstance.address, { gas: 6721975 });
  const crimeInstance = await EvidenceChainCrime.deployed();
  console.log(`✅ Crime contract deployed at: ${crimeInstance.address}`);

  // Deploy Case contract with User and Crime contract addresses
  await deployer.deploy(EvidenceChainCase, userInstance.address, crimeInstance.address, { gas: 6721975 });
  const caseInstance = await EvidenceChainCase.deployed();
  console.log(`✅ Case contract deployed at: ${caseInstance.address}`);

  // Deploy Evidence contract with User and Case contract addresses
  await deployer.deploy(EvidenceChainEvidence, userInstance.address, caseInstance.address, { gas: 6721975 });
  const evidenceInstance = await EvidenceChainEvidence.deployed();
  console.log(`✅ Evidence contract deployed at: ${evidenceInstance.address}`);
};


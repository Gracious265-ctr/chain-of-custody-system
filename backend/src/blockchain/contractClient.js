const Web3 = require('web3').default;
const fs = require('fs');
const path = require('path');

const web3 = new Web3('http://127.0.0.1:7545');

// Load contract ABIs
const loadContract = (contractName) => {
    const artifactPath = path.resolve(__dirname, `../../build/contracts/${contractName}.json`);
    try {
        const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
        return artifact;
    } catch (error) {
        console.error(`❌ Failed to load ${contractName} artifact. Run 'truffle compile' first.`);
        process.exit(1);
    }
};

// Get deployed addresses
const networkId = '5777';
let userAddress = null;
let crimeAddress = null;
let caseAddress = null;
let evidenceAddress = null;

const loadAddresses = () => {
    const userArtifact = loadContract('EvidenceChainUser');
    const crimeArtifact = loadContract('EvidenceChainCrime');
    const caseArtifact = loadContract('EvidenceChainCase');
    const evidenceArtifact = loadContract('EvidenceChainEvidence');

    if (userArtifact.networks && userArtifact.networks[networkId]) {
        userAddress = userArtifact.networks[networkId].address;
    }
    if (crimeArtifact.networks && crimeArtifact.networks[networkId]) {
        crimeAddress = crimeArtifact.networks[networkId].address;
    }
    if (caseArtifact.networks && caseArtifact.networks[networkId]) {
        caseAddress = caseArtifact.networks[networkId].address;
    }
    if (evidenceArtifact.networks && evidenceArtifact.networks[networkId]) {
        evidenceAddress = evidenceArtifact.networks[networkId].address;
    }
};

loadAddresses();

console.log(`✅ User contract: ${userAddress}`);
console.log(`✅ Crime contract: ${crimeAddress}`);
console.log(`✅ Case contract: ${caseAddress}`);
console.log(`✅ Evidence contract: ${evidenceAddress}`);

let userContract = null;
let crimeContract = null;
let caseContract = null;
let evidenceContract = null;

const initContracts = async () => {
    if (!userAddress || !crimeAddress || !caseAddress || !evidenceAddress) {
        throw new Error("Contract addresses missing. Run 'truffle migrate' first.");
    }

    const userArtifact = loadContract('EvidenceChainUser');
    const crimeArtifact = loadContract('EvidenceChainCrime');
    const caseArtifact = loadContract('EvidenceChainCase');
    const evidenceArtifact = loadContract('EvidenceChainEvidence');

    userContract = new web3.eth.Contract(userArtifact.abi, userAddress);
    crimeContract = new web3.eth.Contract(crimeArtifact.abi, crimeAddress);
    caseContract = new web3.eth.Contract(caseArtifact.abi, caseAddress);
    evidenceContract = new web3.eth.Contract(evidenceArtifact.abi, evidenceAddress);

    console.log(`✅ User contract loaded at ${userAddress}`);
    console.log(`✅ Crime contract loaded at ${crimeAddress}`);
    console.log(`✅ Case contract loaded at ${caseAddress}`);
    console.log(`✅ Evidence contract loaded at ${evidenceAddress}`);

    return { userContract, crimeContract, caseContract, evidenceContract, web3 };
};

module.exports = { initContracts, web3 };
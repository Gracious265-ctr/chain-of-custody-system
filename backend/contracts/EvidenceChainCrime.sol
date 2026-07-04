// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./EvidenceChainUser.sol";

contract EvidenceChainCrime {
    EvidenceChainUser public userContract;
    
    struct Crime {
        string name;
        string createdBy;
        uint256 timestamp;
        bool exists;
    }

    mapping(string => Crime) public crimes;
    string[] public crimeIds;

    event CrimeCreated(string id, string name);

    constructor(address _userContract) {
        userContract = EvidenceChainUser(_userContract);
    }

    modifier onlyOfficer() {
        EvidenceChainUser.User memory user = userContract.getUserByAddress(msg.sender);
        require(user.exists, "UR");
        require(user.isActive, "AD");
        require(keccak256(abi.encodePacked(user.role)) == keccak256(abi.encodePacked("Officer")), "AO");
        _;
    }

    function addCrime(string memory _id, string memory _name) public onlyOfficer {
        require(!crimes[_id].exists, "CI");
        
        crimes[_id] = Crime({
            name: _name,
            createdBy: userContract.getUserByAddress(msg.sender).username,
            timestamp: block.timestamp,
            exists: true
        });
        crimeIds.push(_id);
        emit CrimeCreated(_id, _name);
    }

    function getAllCrimeIds() public view returns (string[] memory) {
        return crimeIds;
    }

    function getCrime(string memory _id) public view returns (Crime memory) {
        return crimes[_id];
    }
}


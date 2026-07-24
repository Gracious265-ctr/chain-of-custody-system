// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./EvidenceChainUser.sol";
import "./EvidenceChainCrime.sol";

contract EvidenceChainCase {
    EvidenceChainUser public userContract;
    EvidenceChainCrime public crimeContract;
    
    struct Case {
        string caseNumber;
        string title;
        string description;
        string crimeId;
        string createdBy;
        string prosecutorId;
        string analystId;
        uint256 timestamp;
        bool isClosed;
        bool exists;
    }

    struct ClosureReport {
        string reportHash;
        string reportName;
        uint256 closureDate;
        bool exists;
    }

    mapping(string => Case) public cases;
    mapping(string => ClosureReport) public closureReports;
    string[] public caseIds;

    event CaseCreated(string id, string caseNumber);
    event CaseAssigned(string id, string prosecutorId);
    event CaseAssignedToAnalyst(string id, string analystId);
    event CaseUnassignedFromProsecutor(string id);
    event CaseUnassignedFromAnalyst(string id);
    event CaseStatusChanged(string id, bool isClosed);
    event CaseClosedWithReport(string id, string reportHash, string reportName);

    constructor(address _userContract, address _crimeContract) {
        userContract = EvidenceChainUser(_userContract);
        crimeContract = EvidenceChainCrime(_crimeContract);
    }

    function _isOfficer(address _addr) internal view returns (bool) {
        EvidenceChainUser.User memory user = userContract.getUserByAddress(_addr);
        if (!user.exists) return false;
        if (!user.isActive) return false;
        return keccak256(abi.encodePacked(user.role)) == keccak256(abi.encodePacked("Officer"));
    }

    function _isAdmin(address _addr) internal view returns (bool) {
        EvidenceChainUser.User memory user = userContract.getUserByAddress(_addr);
        if (!user.exists) return false;
        return keccak256(abi.encodePacked(user.role)) == keccak256(abi.encodePacked("Administrator"));
    }

    function _isProsecutor(address _addr) internal view returns (bool) {
        EvidenceChainUser.User memory user = userContract.getUserByAddress(_addr);
        if (!user.exists) return false;
        if (!user.isActive) return false;
        return keccak256(abi.encodePacked(user.role)) == keccak256(abi.encodePacked("Prosecutor"));
    }

    function _isAnalyst(address _addr) internal view returns (bool) {
        EvidenceChainUser.User memory user = userContract.getUserByAddress(_addr);
        if (!user.exists) return false;
        if (!user.isActive) return false;
        return keccak256(abi.encodePacked(user.role)) == keccak256(abi.encodePacked("Analyst"));
    }

    function _getUsername(address _addr) internal view returns (string memory) {
        return userContract.getUserByAddress(_addr).username;
    }

    function _getUserStationId(address _addr) internal view returns (string memory) {
        return userContract.getUserByAddress(_addr).stationId;
    }

    function _getUserAddress(string memory _username) internal view returns (address) {
        address[] memory allAddresses = userContract.getAllUserAddresses();
        for(uint i = 0; i < allAddresses.length; i++) {
            string memory username = userContract.getUserByAddress(allAddresses[i]).username;
            if (_stringsEqual(username, _username)) {
                return allAddresses[i];
            }
        }
        return address(0);
    }

    function _strLen(string memory str) internal pure returns (uint256) {
        return bytes(str).length;
    }

    function _stringsEqual(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(abi.encodePacked(a)) == keccak256(abi.encodePacked(b));
    }

    function addCase(
        string memory _id,
        string memory _caseNumber,
        string memory _title,
        string memory _description,
        string memory _crimeId
    ) public {
        require(_isOfficer(msg.sender), "NO");
        require(!cases[_id].exists, "CI");
        require(crimeContract.getCrime(_crimeId).exists, "CD");
        
        cases[_id] = Case({
            caseNumber: _caseNumber,
            title: _title,
            description: _description,
            crimeId: _crimeId,
            createdBy: _getUsername(msg.sender),
            prosecutorId: "",
            analystId: "",
            timestamp: block.timestamp,
            isClosed: false,
            exists: true
        });
        caseIds.push(_id);
        emit CaseCreated(_id, _caseNumber);
    }

    function assignCaseToAnalyst(string memory _caseId, string memory _analystId) public {
        require(cases[_caseId].exists, "CD");
        require(_isAdmin(msg.sender) || _stringsEqual(_getUserStationId(msg.sender), _getUserStationId(_getUserAddress(_analystId))), "NA");
        cases[_caseId].analystId = _analystId;
        emit CaseAssignedToAnalyst(_caseId, _analystId);
    }

    function assignCaseToProsecutor(string memory _caseId, string memory _prosecutorId) public {
        require(cases[_caseId].exists, "CD");
        require(_isAdmin(msg.sender) || _stringsEqual(_getUserStationId(msg.sender), _getUserStationId(_getUserAddress(_prosecutorId))), "NA");
        cases[_caseId].prosecutorId = _prosecutorId;
        emit CaseAssigned(_caseId, _prosecutorId);
    }

    function unassignCaseFromProsecutor(string memory _caseId) public {
        require(cases[_caseId].exists, "CD");
        require(_isAdmin(msg.sender) || _stringsEqual(_getUserStationId(msg.sender), _getUserStationId(msg.sender)), "NA");
        cases[_caseId].prosecutorId = "";
        emit CaseUnassignedFromProsecutor(_caseId);
    }

    function unassignCaseFromAnalyst(string memory _caseId) public {
        require(cases[_caseId].exists, "CD");
        require(_isAdmin(msg.sender) || _stringsEqual(_getUserStationId(msg.sender), _getUserStationId(msg.sender)), "NA");
        cases[_caseId].analystId = "";
        emit CaseUnassignedFromAnalyst(_caseId);
    }

    function toggleCaseStatus(string memory _id) public {
        require(cases[_id].exists, "CD");
        require(_isAdmin(msg.sender) || _stringsEqual(_getUserStationId(msg.sender), _getUserStationId(msg.sender)), "NA");
        cases[_id].isClosed = !cases[_id].isClosed;
        emit CaseStatusChanged(_id, cases[_id].isClosed);
    }

    function closeCaseWithReport(
        string memory _caseId,
        string memory _reportHash,
        string memory _reportName
    ) public {
        require(cases[_caseId].exists, "CD");
        require(_isProsecutor(msg.sender), "NP");
        
        Case storage caseData = cases[_caseId];
        require(_stringsEqual(caseData.prosecutorId, _getUsername(msg.sender)), "NPA");
        require(!caseData.isClosed, "AC");
        require(_strLen(_reportHash) > 0, "RH");
        require(_strLen(_reportName) > 0, "RN");
        
        caseData.isClosed = true;
        
        closureReports[_caseId] = ClosureReport({
            reportHash: _reportHash,
            reportName: _reportName,
            closureDate: block.timestamp,
            exists: true
        });
        
        emit CaseClosedWithReport(_caseId, _reportHash, _reportName);
        emit CaseStatusChanged(_caseId, true);
    }

    function reopenCase(string memory _caseId) public {
        require(cases[_caseId].exists, "CD");
        require(_isAdmin(msg.sender), "AA");
        
        Case storage caseData = cases[_caseId];
        require(caseData.isClosed, "NC");
        
        caseData.isClosed = false;
        delete closureReports[_caseId];
        
        emit CaseStatusChanged(_caseId, false);
    }

    function getCaseClosureReport(string memory _caseId) public view returns (ClosureReport memory) {
        require(cases[_caseId].exists, "CD");
        return closureReports[_caseId];
    }

    function hasClosureReport(string memory _caseId) public view returns (bool) {
        require(cases[_caseId].exists, "CD");
        return closureReports[_caseId].exists;
    }

    function getAllCaseIds() public view returns (string[] memory) {
        return caseIds;
    }

    function getCase(string memory _id) public view returns (Case memory) {
        return cases[_id];
    }

    // ✅ NEW: Get all closed case IDs
    function getClosedCaseIds() public view returns (string[] memory) {
        uint256 closedCount = 0;
        for(uint i = 0; i < caseIds.length; i++) {
            if (cases[caseIds[i]].isClosed) {
                closedCount++;
            }
        }
        
        string[] memory closedCaseIds = new string[](closedCount);
        uint256 index = 0;
        for(uint i = 0; i < caseIds.length; i++) {
            if (cases[caseIds[i]].isClosed) {
                closedCaseIds[index] = caseIds[i];
                index++;
            }
        }
        return closedCaseIds;
    }
}

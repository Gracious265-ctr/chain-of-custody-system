// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./EvidenceChainUser.sol";
import "./EvidenceChainCase.sol";

contract EvidenceChainEvidence {
    EvidenceChainUser public userContract;
    EvidenceChainCase public caseContract;
    
    struct Evidence {
        string name;
        string description;
        string ipfsHash;
        string fileType;
        uint256 size;
        string uploaderId;
        string caseId;
        bool isCourtReady;
        bool isWeak;
        bool isArchived;
        uint256 timestamp;
        bool exists;
    }

    struct SupportingEvidence {
        string name;
        string description;
        string ipfsHash;
        string fileType;
        uint256 size;
        string uploaderId;
        string caseId;
        string evidenceId;
        bool isArchived;
        uint256 timestamp;
        bool exists;
    }

    struct CustodyLog {
        string actorId;
        string action;
        string notes;
        uint256 timestamp;
    }

    mapping(string => Evidence) public evidenceRecords;
    mapping(string => SupportingEvidence) public supportingEvidenceRecords;
    mapping(string => CustodyLog[]) public evidenceHistory;
    mapping(string => CustodyLog[]) public supportingEvidenceHistory;
    string[] public evidenceIds;
    string[] public supportingEvidenceIds;

    event EvidenceUploaded(string id, string ipfsHash, address indexed uploader);
    event EvidenceMarkedCourtReady(string id, bool status);
    event EvidenceMarkedWeak(string id, bool status, string reason);
    event EvidenceCaseUpdated(string id, string newCaseId);
    event EvidenceArchived(string id, address indexed archivedBy);
    event EvidenceRestored(string id, address indexed restoredBy);
    event SupportingEvidenceArchived(string id, address indexed archivedBy);
    event SupportingEvidenceRestored(string id, address indexed restoredBy);
    event SupportingEvidenceUploaded(string id, string ipfsHash, address indexed uploader);

    constructor(address _userContract, address _caseContract) {
        userContract = EvidenceChainUser(_userContract);
        caseContract = EvidenceChainCase(_caseContract);
    }

    function _isOfficer(address _addr) internal view returns (bool) {
        EvidenceChainUser.User memory user = userContract.getUserByAddress(_addr);
        if (!user.exists) return false;
        if (!user.isActive) return false;
        return keccak256(abi.encodePacked(user.role)) == keccak256(abi.encodePacked("Officer"));
    }

    function _isProsecutor(address _addr) internal view returns (bool) {
        EvidenceChainUser.User memory user = userContract.getUserByAddress(_addr);
        if (!user.exists) return false;
        if (!user.isActive) return false;
        return keccak256(abi.encodePacked(user.role)) == keccak256(abi.encodePacked("Prosecutor"));
    }

    function _isAdmin(address _addr) internal view returns (bool) {
        EvidenceChainUser.User memory user = userContract.getUserByAddress(_addr);
        if (!user.exists) return false;
        return keccak256(abi.encodePacked(user.role)) == keccak256(abi.encodePacked("Administrator"));
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

    function _strLen(string memory str) internal pure returns (uint256) {
        return bytes(str).length;
    }

    function addEvidence(
        string memory _id,
        string memory _name,
        string memory _description,
        string memory _ipfsHash,
        string memory _fileType,
        uint256 _size,
        string memory _uploaderId,
        string memory _caseId
    ) public {
        require(_isOfficer(msg.sender), "NO");
        require(!evidenceRecords[_id].exists, "EI");
        if(_strLen(_caseId) > 0) {
            require(caseContract.getCase(_caseId).exists, "CD");
        }
        
        evidenceRecords[_id] = Evidence({
            name: _name,
            description: _description,
            ipfsHash: _ipfsHash,
            fileType: _fileType,
            size: _size,
            uploaderId: _uploaderId,
            caseId: _caseId,
            isCourtReady: false,
            isWeak: false,
            isArchived: false,
            timestamp: block.timestamp,
            exists: true
        });

        evidenceIds.push(_id);
        emit EvidenceUploaded(_id, _ipfsHash, msg.sender);
    }

    function addSupportingEvidence(
        string memory _id,
        string memory _name,
        string memory _description,
        string memory _ipfsHash,
        string memory _fileType,
        uint256 _size,
        string memory _uploaderId,
        string memory _caseId,
        string memory _evidenceId
    ) public {
        require(_isAnalyst(msg.sender), "NA");
        require(!supportingEvidenceRecords[_id].exists, "SI");
        require(caseContract.getCase(_caseId).exists, "CD");
        
        EvidenceChainCase.Case memory caseData = caseContract.getCase(_caseId);
        require(_strLen(caseData.analystId) > 0, "NAC");
        require(keccak256(abi.encodePacked(caseData.analystId)) == keccak256(abi.encodePacked(_uploaderId)), "NAC");
        
        supportingEvidenceRecords[_id] = SupportingEvidence({
            name: _name,
            description: _description,
            ipfsHash: _ipfsHash,
            fileType: _fileType,
            size: _size,
            uploaderId: _uploaderId,
            caseId: _caseId,
            evidenceId: _evidenceId,
            isArchived: false,
            timestamp: block.timestamp,
            exists: true
        });

        supportingEvidenceIds.push(_id);
        emit SupportingEvidenceUploaded(_id, _ipfsHash, msg.sender);
        
        string memory logNote = string(abi.encodePacked(
            "Analyst ", _uploaderId, " uploaded '", _name, "' for case ", _caseId
        ));
        logSupportingAction(_id, _uploaderId, "SUPPORTING_EVIDENCE_UPLOAD", logNote);
    }

    function assignEvidenceToCase(string memory _evidenceId, string memory _newCaseId) public {
        require(_isOfficer(msg.sender), "NO");
        require(evidenceRecords[_evidenceId].exists, "ED");
        if(_strLen(_newCaseId) > 0) {
            require(caseContract.getCase(_newCaseId).exists, "CD");
        }
        
        evidenceRecords[_evidenceId].caseId = _newCaseId;
        emit EvidenceCaseUpdated(_evidenceId, _newCaseId);
        
        string memory logNote = string(abi.encodePacked(
            "Officer ", _getUsername(msg.sender), " assigned evidence to case ", _newCaseId
        ));
        logAction(_evidenceId, _getUsername(msg.sender), "EVIDENCE_CASE_ASSIGN", logNote);
    }

    function markEvidenceCourtReady(string memory _id, bool _isCourtReady) public {
        require(_isProsecutor(msg.sender), "NP");
        require(evidenceRecords[_id].exists, "ED");
        
        string memory caseId = evidenceRecords[_id].caseId;
        require(_strLen(caseId) > 0, "EN");
        require(keccak256(abi.encodePacked(caseContract.getCase(caseId).prosecutorId)) == keccak256(abi.encodePacked(_getUsername(msg.sender))), "NPA");

        if (_isCourtReady && evidenceRecords[_id].isWeak) {
            evidenceRecords[_id].isWeak = false;
        }

        evidenceRecords[_id].isCourtReady = _isCourtReady;
        emit EvidenceMarkedCourtReady(_id, _isCourtReady);
        
        string memory logNote = string(abi.encodePacked(
            "Prosecutor ", _getUsername(msg.sender), " marked evidence Court Ready"
        ));
        logAction(_id, _getUsername(msg.sender), "COURT_READY", logNote);
    }

    function markEvidenceWeak(string memory _id, bool _isWeak, string memory _reason) public {
        require(_isProsecutor(msg.sender), "NP");
        require(evidenceRecords[_id].exists, "ED");
        
        string memory caseId = evidenceRecords[_id].caseId;
        require(_strLen(caseId) > 0, "EN");
        require(keccak256(abi.encodePacked(caseContract.getCase(caseId).prosecutorId)) == keccak256(abi.encodePacked(_getUsername(msg.sender))), "NPA");

        if (_isWeak && evidenceRecords[_id].isCourtReady) {
            evidenceRecords[_id].isCourtReady = false;
        }

        evidenceRecords[_id].isWeak = _isWeak;
        
        string memory logNote;
        
        if (_isWeak) {
            logNote = string(abi.encodePacked(
                "Prosecutor ", _getUsername(msg.sender), " marked evidence Weak. Reason: ", _reason
            ));
        } else {
            logNote = string(abi.encodePacked(
                "Prosecutor ", _getUsername(msg.sender), " unmarked evidence Weak"
            ));
        }
        
        logAction(_id, _getUsername(msg.sender), "WEAK_EVIDENCE", logNote);
        
        emit EvidenceMarkedWeak(_id, _isWeak, _reason);
    }

    function archiveEvidence(string memory _id) public {
        require(_isAdmin(msg.sender), "AA");
        require(evidenceRecords[_id].exists, "ED");
        require(!evidenceRecords[_id].isArchived, "EA");
        
        evidenceRecords[_id].isArchived = true;
        emit EvidenceArchived(_id, msg.sender);
        
        string memory logNote = string(abi.encodePacked(
            "Admin ", _getUsername(msg.sender), " archived evidence"
        ));
        logAction(_id, _getUsername(msg.sender), "EVIDENCE_ARCHIVED", logNote);
    }

    function restoreEvidence(string memory _id) public {
        require(_isAdmin(msg.sender), "AA");
        require(evidenceRecords[_id].exists, "ED");
        require(evidenceRecords[_id].isArchived, "NA");
        
        evidenceRecords[_id].isArchived = false;
        emit EvidenceRestored(_id, msg.sender);
        
        string memory logNote = string(abi.encodePacked(
            "Admin ", _getUsername(msg.sender), " restored evidence"
        ));
        logAction(_id, _getUsername(msg.sender), "EVIDENCE_RESTORED", logNote);
    }

    function archiveSupportingEvidence(string memory _id) public {
        require(_isAdmin(msg.sender), "AA");
        require(supportingEvidenceRecords[_id].exists, "SE");
        require(!supportingEvidenceRecords[_id].isArchived, "EA");
        
        supportingEvidenceRecords[_id].isArchived = true;
        emit SupportingEvidenceArchived(_id, msg.sender);
    }

    function restoreSupportingEvidence(string memory _id) public {
        require(_isAdmin(msg.sender), "AA");
        require(supportingEvidenceRecords[_id].exists, "SE");
        require(supportingEvidenceRecords[_id].isArchived, "NA");
        
        supportingEvidenceRecords[_id].isArchived = false;
        emit SupportingEvidenceRestored(_id, msg.sender);
    }

    function logAction(string memory _id, string memory _actorId, string memory _action, string memory _notes) public {
        require(evidenceRecords[_id].exists, "ED");
        evidenceHistory[_id].push(CustodyLog({
            actorId: _actorId,
            action: _action,
            notes: _notes,
            timestamp: block.timestamp
        }));
    }

    function logSupportingAction(string memory _id, string memory _actorId, string memory _action, string memory _notes) public {
        require(supportingEvidenceRecords[_id].exists, "SE");
        supportingEvidenceHistory[_id].push(CustodyLog({
            actorId: _actorId,
            action: _action,
            notes: _notes,
            timestamp: block.timestamp
        }));
    }

    function getEvidence(string memory _id) public view returns (Evidence memory) {
        return evidenceRecords[_id];
    }

    function getSupportingEvidence(string memory _id) public view returns (SupportingEvidence memory) {
        return supportingEvidenceRecords[_id];
    }

    function getHistory(string memory _id) public view returns (CustodyLog[] memory) {
        return evidenceHistory[_id];
    }

    function getSupportingHistory(string memory _id) public view returns (CustodyLog[] memory) {
        return supportingEvidenceHistory[_id];
    }

    function getAllEvidenceIds() public view returns (string[] memory) {
        return evidenceIds;
    }

    function getAllSupportingEvidenceIds() public view returns (string[] memory) {
        return supportingEvidenceIds;
    }
}

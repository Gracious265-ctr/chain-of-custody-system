// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract EvidenceChainUser {
    
    struct User {
        string username;
        string role;
        string stationId;
        bool exists;
        bool isActive;
    }

    mapping(address => User) public users;
    address[] public userAddresses;
    uint256 public totalUsers;

    struct Station {
        string name;
        string location;
        bool exists;
    }
    mapping(string => Station) public stations;
    string[] public stationIds;

    event UserRegistered(string username, string role, string stationId, address indexed userAddress);
    event UserStatusChanged(string username, bool isActive);
    event StationCreated(string id, string name, string location);

    function _eq(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(abi.encodePacked(a)) == keccak256(abi.encodePacked(b));
    }

    function createStation(string memory _id, string memory _name, string memory _location) public {
        require(msg.sender == userAddresses[0], "SA");
        require(!stations[_id].exists, "SE");

        stations[_id] = Station({
            name: _name,
            location: _location,
            exists: true
        });
        stationIds.push(_id);
        emit StationCreated(_id, _name, _location);
    }

    function adminRegisterUser(
        address _userAddress,
        string memory _username,
        string memory _role,
        string memory _stationId
    ) public {
        require(!users[_userAddress].exists, "AR");
        
        if (totalUsers == 0) {
            users[_userAddress] = User({
                username: _username,
                role: "SuperAdmin",
                stationId: "",
                exists: true,
                isActive: true
            });
            userAddresses.push(_userAddress);
            totalUsers++;
            emit UserRegistered(_username, "SuperAdmin", "", _userAddress);
            return;
        }
        
        require(msg.sender == userAddresses[0] || _eq(users[msg.sender].role, "StationAdmin"), "AA");
        User memory caller = users[msg.sender];
        
        if (_eq(caller.role, "SuperAdmin")) {
            require(bytes(_stationId).length > 0, "SI");
            require(stations[_stationId].exists, "SN");
        } else if (_eq(caller.role, "StationAdmin")) {
            require(_eq(caller.stationId, _stationId), "SP");
            require(_eq(_role, "Officer") || _eq(_role, "Prosecutor") || _eq(_role, "Analyst"), "RO");
        } else {
            revert("AC");
        }

        users[_userAddress] = User({
            username: _username,
            role: _role,
            stationId: _stationId,
            exists: true,
            isActive: true
        });
        userAddresses.push(_userAddress);
        totalUsers++;
        emit UserRegistered(_username, _role, _stationId, _userAddress);
    }

    function getUserByAddress(address _userAddress) public view returns (User memory) {
        return users[_userAddress];
    }

    function disableUser(address _targetAddress, bool _isActive) public {
        require(msg.sender == userAddresses[0] || _eq(users[msg.sender].role, "StationAdmin"), "AA");
        User memory caller = users[msg.sender];
        User memory target = users[_targetAddress];
        require(target.exists, "UD");
        require(_targetAddress != msg.sender, "CD");
        if (_eq(caller.role, "StationAdmin")) {
            require(_eq(caller.stationId, target.stationId), "SP");
        }
        users[_targetAddress].isActive = _isActive;
        emit UserStatusChanged(users[_targetAddress].username, _isActive);
    }

    function getAllUsers() public view returns (User[] memory) {
        User[] memory allUsers = new User[](userAddresses.length);
        for(uint i = 0; i < userAddresses.length; i++) {
            allUsers[i] = users[userAddresses[i]];
        }
        return allUsers;
    }

    function getAllUserAddresses() public view returns (address[] memory) {
        return userAddresses;
    }

    function getUserCount() public view returns (uint256) {
        return totalUsers;
    }

    function getAllStations() public view returns (Station[] memory) {
        Station[] memory allStations = new Station[](stationIds.length);
        for(uint i = 0; i < stationIds.length; i++) {
            allStations[i] = stations[stationIds[i]];
        }
        return allStations;
    }

    function getStation(string memory _id) public view returns (Station memory) {
        return stations[_id];
    }

    function getStationIds() public view returns (string[] memory) {
        return stationIds;
    }

    function getStationName(string memory _id) public view returns (string memory) {
        return stations[_id].name;
    }
}


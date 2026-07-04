const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { initContracts, web3 } = require('./blockchain/contractClient');
const { sendPasswordEmail, sendPasswordChangedEmail } = require('./services/emailService');
const PDFDocument = require('pdfkit');

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const STATIONS_FILE = path.join(DATA_DIR, 'stations.json');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
}

let usersCache = new Map();
let stationsCache = new Map();

// ============================================
// CACHE FUNCTIONS
// ============================================

function saveCache() {
    try {
        const usersObj = Object.fromEntries(usersCache);
        fs.writeFileSync(USERS_FILE, JSON.stringify(usersObj, null, 2));
        
        const stationsObj = Object.fromEntries(stationsCache);
        fs.writeFileSync(STATIONS_FILE, JSON.stringify(stationsObj, null, 2));
        
        console.log(`💾 Saved ${usersCache.size} users and ${stationsCache.size} stations`);
    } catch (error) {
        console.error('Error saving cache:', error);
    }
}

async function loadCache() {
    try {
        if (fs.existsSync(USERS_FILE)) {
            const usersData = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
            for (const [key, value] of Object.entries(usersData)) {
                usersCache.set(key, value);
            }
        }
        if (fs.existsSync(STATIONS_FILE)) {
            const stationsData = JSON.parse(fs.readFileSync(STATIONS_FILE, 'utf8'));
            for (const [key, value] of Object.entries(stationsData)) {
                stationsCache.set(key, value);
            }
        }
        console.log(`📂 Loaded cache: ${usersCache.size} users and ${stationsCache.size} stations`);
    } catch (error) {
        console.error('Error loading cache:', error);
    }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function getNextAvailableAccount() {
    const accounts = await web3.eth.getAccounts();
    const { userContract } = await initContracts();
    for(let i = 0; i < accounts.length; i++) {
        try {
            const user = await userContract.methods.getUserByAddress(accounts[i]).call();
            if(!user.exists) return accounts[i]; 
        } catch(e) {}
    }
    return null; 
}

function generatePassword() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

function generateToken(address) {
    return jwt.sign({ address }, process.env.JWT_SECRET, { expiresIn: '24h' });
}

// ============================================
// STARTUP SEQUENCE
// ============================================

async function initSystem() {
    await loadCache();
    
    const { userContract } = await initContracts();
    
    const stationIds = await userContract.methods.getStationIds().call();
    const allStations = await userContract.methods.getAllStations().call();
    for (let i = 0; i < stationIds.length; i++) {
        const id = stationIds[i];
        const station = allStations[i];
        stationsCache.set(id, {
            name: station.name,
            location: station.location
        });
    }
    
    const addresses = await userContract.methods.getAllUserAddresses().call();
    const allUsers = await userContract.methods.getAllUsers().call();
    for (let i = 0; i < addresses.length; i++) {
        const address = addresses[i];
        const blockchainUser = allUsers[i];
        
        const existingUser = usersCache.get(address);
        if (existingUser) {
            existingUser.role = blockchainUser.role;
            existingUser.stationId = blockchainUser.stationId;
            existingUser.isActive = blockchainUser.isActive;
            usersCache.set(address, existingUser);
        } else {
            usersCache.set(address, {
                email: `${blockchainUser.username}@chainofcustody.local`,
                username: blockchainUser.username,
                passwordHash: await bcrypt.hash(generatePassword(), 10),
                role: blockchainUser.role,
                stationId: blockchainUser.stationId,
                isActive: blockchainUser.isActive,
                mustChangePassword: true,
                createdAt: new Date().toISOString()
            });
        }
    }
    
    saveCache();
    
    const count = await userContract.methods.getUserCount().call();
    if (count == 0) {
        console.log('⚠️ No users on blockchain. Creating initial SuperAdmin...');
        const accounts = await web3.eth.getAccounts();
        const adminAddress = accounts[0];
        await userContract.methods.adminRegisterUser(adminAddress, "admin", "SuperAdmin", "").send({ from: adminAddress, gas: 3000000 });
        const defaultPassword = "Admin123!";
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(defaultPassword, 10);
        usersCache.set(adminAddress, {
            email: "admin@chainofcustody.local",
            username: "admin",
            passwordHash: passwordHash,
            role: "SuperAdmin",
            stationId: "",
            isActive: true,
            mustChangePassword: false,
            createdAt: new Date().toISOString()
        });
        saveCache();
        console.log('✅ Initial SuperAdmin created!');
        console.log('📧 Email: admin@chainofcustody.local');
        console.log('👤 Username: admin');
        console.log('🔑 Default Password: Admin123!');
    } else {
        console.log(`✅ ${count} users found on blockchain.`);
    }
}

initSystem();

process.on('SIGINT', () => {
    console.log('\nSaving cache...');
    saveCache();
    process.exit(0);
});

// ============================================
// MIDDLEWARE
// ============================================

const authenticate = async (req, res, next) => {
    try {
        const token = req.headers['authorization'];
        if (!token) return res.status(401).json({ error: 'Token required' });
        const tokenParts = token.split(' ');
        const actualToken = tokenParts.length > 1 ? tokenParts[1] : token;
        const decoded = jwt.verify(actualToken, process.env.JWT_SECRET);
        const address = decoded.address;
        const { userContract } = await initContracts();
        const blockchainUser = await userContract.methods.getUserByAddress(address).call({ from: address });
        if (!blockchainUser.exists) return res.status(403).json({ error: 'User not registered on blockchain' });
        if (!blockchainUser.isActive) return res.status(403).json({ error: 'Account disabled' });
        const user = usersCache.get(address);
        if (!user) {
            const newUser = {
                email: `${blockchainUser.username}@chainofcustody.local`,
                username: blockchainUser.username,
                passwordHash: await bcrypt.hash(generatePassword(), 10),
                role: blockchainUser.role,
                stationId: blockchainUser.stationId,
                isActive: blockchainUser.isActive,
                mustChangePassword: false,
                createdAt: new Date().toISOString()
            };
            usersCache.set(address, newUser);
            saveCache();
            req.user = newUser;
        } else {
            req.user = user;
        }
        req.address = address;
        req.blockchainUser = blockchainUser;
        next();
    } catch (error) {
        console.error('Auth Error:', error);
        res.status(401).json({ error: 'Invalid or expired token' });
    }
};

const authenticateRead = async (req, res, next) => {
    try {
        const token = req.headers['authorization'];
        if (!token) {
            req.user = { role: 'Anonymous', username: 'Unknown', stationId: '' };
            req.address = null;
            return next();
        }
        const tokenParts = token.split(' ');
        const actualToken = tokenParts.length > 1 ? tokenParts[1] : token;
        const decoded = jwt.verify(actualToken, process.env.JWT_SECRET);
        const address = decoded.address;
        const { userContract } = await initContracts();
        const blockchainUser = await userContract.methods.getUserByAddress(address).call({ from: address });
        if (blockchainUser.exists && blockchainUser.isActive) {
            const user = usersCache.get(address);
            if (user) {
                req.user = user;
                req.address = address;
                req.blockchainUser = blockchainUser;
                return next();
            }
        }
        req.user = { role: 'Anonymous', username: 'Unknown', stationId: '' };
        req.address = address;
        next();
    } catch (error) {
        req.user = { role: 'Anonymous', username: 'Unknown', stationId: '' };
        req.address = null;
        next();
    }
};

const allowRoles = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: `Access Denied. Requires: ${roles.join(', ')}` });
        }
        next();
    };
};

// ============================================
// STATION ROUTES
// ============================================

app.post('/api/admin/stations', authenticate, allowRoles('SuperAdmin'), async (req, res) => {
    try {
        const { name, location } = req.body;
        if (!name) return res.status(400).json({ error: 'Station name is required' });
        if (!location) return res.status(400).json({ error: 'Location is required' });
        
        const { userContract } = await initContracts();
        const stationId = `ST-${Date.now()}`;
        await userContract.methods.createStation(stationId, name, location).send({ from: req.address, gas: 3000000 });
        stationsCache.set(stationId, { name, location });
        saveCache();
        res.status(201).json({ message: `Station "${name}" created successfully`, stationId });
    } catch (error) {
        console.error('Create Station Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/admin/stations', authenticate, async (req, res) => {
    try {
        const { userContract } = await initContracts();
        const stationIds = await userContract.methods.getStationIds().call();
        const allStations = await userContract.methods.getAllStations().call();
        for (let i = 0; i < stationIds.length; i++) {
            const id = stationIds[i];
            const station = allStations[i];
            stationsCache.set(id, { name: station.name, location: station.location });
        }
        saveCache();
        const stationList = [];
        for (const [id, station] of stationsCache) {
            stationList.push({ stationId: id, name: station.name, location: station.location });
        }
        res.json(stationList);
    } catch (error) {
        console.error('Fetch Stations Error:', error);
        res.status(500).json({ error: 'Failed to fetch stations' });
    }
});

app.get('/api/admin/station-name', authenticate, async (req, res) => {
    try {
        const { userContract } = await initContracts();
        const stationId = req.user.stationId;
        if (!stationId) {
            return res.json({ stationName: 'No Station Assigned' });
        }
        const station = await userContract.methods.getStation(stationId).call();
        res.json({ stationName: station.name, stationId });
    } catch (error) {
        console.error('Fetch Station Name Error:', error);
        res.status(500).json({ error: 'Failed to fetch station name' });
    }
});

// ============================================
// USER ROUTES
// ============================================

app.post('/api/admin/users', authenticate, async (req, res) => {
    try {
        const { email, username, role, stationId } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });
        if (!username) return res.status(400).json({ error: 'Username is required' });
        if (!role) return res.status(400).json({ error: 'Role is required' });
        
        let targetStationId = stationId;
        if (req.user.role === 'StationAdmin') {
            targetStationId = req.user.stationId;
            if (!['Officer', 'Prosecutor', 'Analyst'].includes(role)) {
                return res.status(403).json({ error: 'StationAdmin can only create Officers, Prosecutors, or Analysts' });
            }
        } else if (req.user.role === 'SuperAdmin') {
            if (!stationId) return res.status(400).json({ error: 'Station ID is required for SuperAdmin creation' });
            if (!stationsCache.has(stationId)) return res.status(400).json({ error: 'Station not found' });
        } else {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const { userContract } = await initContracts();
        const allAddresses = await userContract.methods.getAllUserAddresses().call();
        const allUsers = await userContract.methods.getAllUsers().call();
        for (let i = 0; i < allAddresses.length; i++) {
            if (allUsers[i].username === username) {
                return res.status(400).json({ error: 'Username already taken' });
            }
        }
        
        const newAddress = await getNextAvailableAccount();
        if (!newAddress) return res.status(500).json({ error: 'No available Ganache accounts for new users.' });
        
        await userContract.methods.adminRegisterUser(newAddress, username, role, targetStationId).send({ from: req.address, gas: 3000000 });
        
        const defaultPassword = generatePassword();
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(defaultPassword, 10);
        usersCache.set(newAddress, { email, username, passwordHash, role, stationId: targetStationId, isActive: true, mustChangePassword: true, createdAt: new Date().toISOString() });
        saveCache();
        
        // Send Email via SendGrid
        const emailResult = await sendPasswordEmail(email, username, defaultPassword, role);
        
        res.status(201).json({
            message: `User ${username} created successfully`,
            address: newAddress, 
            role, 
            stationId: targetStationId, 
            emailSent: emailResult.success,
            emailError: emailResult.error || null,
            tempPassword: process.env.NODE_ENV === 'development' ? defaultPassword : undefined
        });
    } catch (error) {
        console.error('Create User Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/admin/users', authenticate, async (req, res) => {
    try {
        const { userContract } = await initContracts();
        const addresses = await userContract.methods.getAllUserAddresses().call();
        const blockchainUsers = await userContract.methods.getAllUsers().call();
        for (let i = 0; i < addresses.length; i++) {
            const address = addresses[i];
            const blockchainUser = blockchainUsers[i];
            const existingUser = usersCache.get(address);
            if (existingUser) {
                existingUser.role = blockchainUser.role;
                existingUser.stationId = blockchainUser.stationId;
                existingUser.isActive = blockchainUser.isActive;
                usersCache.set(address, existingUser);
            } else {
                usersCache.set(address, {
                    email: `${blockchainUser.username}@chainofcustody.local`,
                    username: blockchainUser.username,
                    passwordHash: await bcrypt.hash(generatePassword(), 10),
                    role: blockchainUser.role,
                    stationId: blockchainUser.stationId,
                    isActive: blockchainUser.isActive,
                    mustChangePassword: true,
                    createdAt: new Date().toISOString()
                });
            }
        }
        saveCache();
        
        let allUsers = [];
        for (const [address, user] of usersCache) {
            if (req.user.role === 'StationAdmin' && user.stationId !== req.user.stationId) continue;
            allUsers.push({
                address,
                email: user.email,
                username: user.username,
                role: user.role,
                stationId: user.stationId,
                isActive: user.isActive,
                mustChangePassword: user.mustChangePassword || false,
                createdAt: user.createdAt
            });
        }
        res.json(allUsers);
    } catch (error) {
        console.error('Fetch Users Error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

app.put('/api/admin/users/:address/status', authenticate, async (req, res) => {
    try {
        const targetAddress = req.params.address;
        const { isActive } = req.body;
        if (targetAddress === req.address) return res.status(400).json({ error: 'Cannot disable your own account' });
        const user = usersCache.get(targetAddress);
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (req.user.role === 'StationAdmin' && user.stationId !== req.user.stationId) return res.status(403).json({ error: 'Cannot manage users outside your station' });
        const { userContract } = await initContracts();
        await userContract.methods.disableUser(targetAddress, isActive).send({ from: req.address, gas: 3000000 });
        user.isActive = isActive;
        usersCache.set(targetAddress, user);
        saveCache();
        res.json({ message: `User status updated to ${isActive ? 'Active' : 'Disabled'}` });
    } catch (error) {
        console.error('Toggle User Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/admin/users/:address/reset-password', authenticate, async (req, res) => {
    try {
        const targetAddress = req.params.address;
        const user = usersCache.get(targetAddress);
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (req.user.role === 'StationAdmin' && user.stationId !== req.user.stationId) return res.status(403).json({ error: 'Cannot manage users outside your station' });
        const newPassword = generatePassword();
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(newPassword, 10);
        user.passwordHash = passwordHash;
        user.mustChangePassword = true;
        usersCache.set(targetAddress, user);
        saveCache();
        const emailResult = await sendPasswordEmail(user.email, user.username, newPassword, user.role);
        res.json({ message: `Password reset for ${user.username}`, emailSent: emailResult.success, tempPassword: process.env.NODE_ENV === 'development' ? newPassword : undefined });
    } catch (error) {
        console.error('Reset Password Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// LOGIN & AUTH
// ============================================

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
        let foundAddress = null, foundUser = null;
        for (const [addr, user] of usersCache) {
            if (user.username === username) { foundAddress = addr; foundUser = user; break; }
        }
        if (!foundAddress || !foundUser) return res.status(401).json({ error: 'Invalid credentials' });
        const { userContract } = await initContracts();
        const blockchainUser = await userContract.methods.getUserByAddress(foundAddress).call({ from: foundAddress });
        if (!blockchainUser.isActive) return res.status(401).json({ error: 'Account disabled' });
        const isValid = await bcrypt.compare(password, foundUser.passwordHash);
        if (!isValid) return res.status(401).json({ error: 'Invalid credentials' });
        const token = generateToken(foundAddress);
        res.json({ token, user: { username: foundUser.username, role: foundUser.role, stationId: foundUser.stationId, email: foundUser.email, mustChangePassword: foundUser.mustChangePassword || false } });
    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

app.post('/api/auth/change-password', authenticate, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Current and new password required' });
        if (newPassword.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
        const user = usersCache.get(req.address);
        const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!isValid) return res.status(401).json({ error: 'Current password is incorrect' });
        const salt = await bcrypt.genSalt(10);
        const newPasswordHash = await bcrypt.hash(newPassword, 10);
        user.passwordHash = newPasswordHash;
        user.mustChangePassword = false;
        usersCache.set(req.address, user);
        saveCache();
        await sendPasswordChangedEmail(user.email, user.username);
        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error('Change Password Error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

// ============================================
// CRIME ROUTES
// ============================================

app.get('/api/crimes', authenticateRead, async (req, res) => {
    try {
        const { crimeContract } = await initContracts();
        const ids = await crimeContract.methods.getAllCrimeIds().call();
        const crimeList = [];
        for (let i = 0; i < ids.length; i++) {
            const crime = await crimeContract.methods.getCrime(ids[i]).call();
            if (crime.exists) crimeList.push({ crime_id: ids[i], name: crime.name, created_by: crime.createdBy, timestamp: new Date(Number(crime.timestamp) * 1000).toISOString() });
        }
        res.json(crimeList);
    } catch (error) {
        console.error('Fetch Crimes Error:', error);
        res.status(500).json({ error: 'Failed to fetch crimes' });
    }
});

app.post('/api/crimes', authenticate, allowRoles('Officer'), async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Crime name required' });
        const crimeId = uuidv4();
        const { crimeContract } = await initContracts();
        await crimeContract.methods.addCrime(crimeId, name).send({ from: req.address, gas: 3000000 });
        res.status(201).json({ message: 'Crime created', crimeId });
    } catch (error) {
        console.error('Create Crime Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// CASE ROUTES
// ============================================

app.post('/api/cases', authenticate, allowRoles('Officer'), async (req, res) => {
    try {
        const { caseNumber, title, description, crimeId } = req.body;
        if (!caseNumber || !title || !crimeId) return res.status(400).json({ error: 'Missing required fields' });
        const caseId = uuidv4();
        const { caseContract } = await initContracts();
        await caseContract.methods.addCase(caseId, caseNumber, title, description || '', crimeId).send({ from: req.address, gas: 3000000 });
        res.status(201).json({ message: 'Case created', caseId });
    } catch (error) {
        console.error('Create Case Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/cases', authenticateRead, async (req, res) => {
    try {
        const { caseContract, userContract } = await initContracts();
        const ids = await caseContract.methods.getAllCaseIds().call();
        const caseList = [];
        const allUsers = await userContract.methods.getAllUsers().call();
        const allAddresses = await userContract.methods.getAllUserAddresses().call();
        
        const userStationMap = {};
        for (let i = 0; i < allUsers.length; i++) {
            userStationMap[allUsers[i].username] = allUsers[i].stationId;
        }
        
        const stationId = req.user.stationId;
        const userRole = req.user.role;
        const username = req.user.username;
        
        for (let i = 0; i < ids.length; i++) {
            const c = await caseContract.methods.getCase(ids[i]).call();
            if (c.exists) {
                // Get the station ID for the case creator
                const caseStationId = userStationMap[c.createdBy] || '';
                
                // Role-based filtering
                if (userRole === 'Officer' && c.createdBy !== username) continue;
                if (userRole === 'StationAdmin' && caseStationId !== stationId) continue;
                if (userRole === 'Prosecutor' && c.prosecutorId !== username) continue;
                if (userRole === 'Analyst' && c.analystId !== username) continue;
                
                caseList.push({
                    case_id: ids[i],
                    case_number: c.caseNumber,
                    title: c.title,
                    description: c.description,
                    crime_id: c.crimeId,
                    created_by: c.createdBy,
                    prosecutor_id: c.prosecutorId,
                    analyst_id: c.analystId,
                    is_closed: c.isClosed,
                    station_id: caseStationId,
                    timestamp: new Date(Number(c.timestamp) * 1000).toISOString()
                });
            }
        }
        res.json(caseList);
    } catch (error) {
        console.error('Fetch Cases Error:', error);
        res.status(500).json({ error: 'Failed to fetch cases' });
    }
});

app.post('/api/admin/cases/assign', authenticate, async (req, res) => {
    try {
        const { caseId, prosecutorId } = req.body;
        if (!caseId || !prosecutorId) return res.status(400).json({ error: 'Case ID and Prosecutor ID required' });
        const { caseContract } = await initContracts();
        await caseContract.methods.assignCaseToProsecutor(caseId, prosecutorId).send({ from: req.address, gas: 3000000 });
        res.json({ message: 'Case assigned to prosecutor successfully' });
    } catch (error) {
        console.error('Assign Case Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/admin/cases/assign-analyst', authenticate, async (req, res) => {
    try {
        const { caseId, analystId } = req.body;
        if (!caseId || !analystId) return res.status(400).json({ error: 'Case ID and Analyst ID required' });
        const { caseContract } = await initContracts();
        await caseContract.methods.assignCaseToAnalyst(caseId, analystId).send({ from: req.address, gas: 3000000 });
        res.json({ message: 'Case assigned to analyst successfully' });
    } catch (error) {
        console.error('Assign Analyst Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/admin/cases/unassign-prosecutor', authenticate, async (req, res) => {
    try {
        const { caseId } = req.body;
        if (!caseId) return res.status(400).json({ error: 'Case ID required' });
        const { caseContract } = await initContracts();
        await caseContract.methods.unassignCaseFromProsecutor(caseId).send({ from: req.address, gas: 3000000 });
        res.json({ message: 'Case unassigned from prosecutor successfully' });
    } catch (error) {
        console.error('Unassign Prosecutor Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/admin/cases/unassign-analyst', authenticate, async (req, res) => {
    try {
        const { caseId } = req.body;
        if (!caseId) return res.status(400).json({ error: 'Case ID required' });
        const { caseContract } = await initContracts();
        await caseContract.methods.unassignCaseFromAnalyst(caseId).send({ from: req.address, gas: 3000000 });
        res.json({ message: 'Case unassigned from analyst successfully' });
    } catch (error) {
        console.error('Unassign Analyst Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/admin/cases/:id/toggle-status', authenticate, async (req, res) => {
    try {
        const caseId = req.params.id;
        const { caseContract } = await initContracts();
        await caseContract.methods.toggleCaseStatus(caseId).send({ from: req.address, gas: 3000000 });
        res.json({ message: 'Case status toggled successfully' });
    } catch (error) {
        console.error('Toggle Case Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// PROSECUTOR CASE CLOSURE WITH REPORT
// ============================================

app.post('/api/prosecutor/cases/:id/close-with-report', authenticate, allowRoles('Prosecutor'), upload.single('file'), async (req, res) => {
    try {
        const caseId = req.params.id;
        const { description } = req.body;
        
        if (!req.file) {
            return res.status(400).json({ error: 'Closure report file is required' });
        }
        
        if (!description || !description.trim()) {
            return res.status(400).json({ error: 'Case closure description is required' });
        }
        
        // Validate file type
        const allowedTypes = [
            'application/pdf', 'application/msword', 
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain', 'text/csv'
        ];
        if (!allowedTypes.includes(req.file.mimetype)) {
            return res.status(400).json({ 
                error: `File type "${req.file.mimetype}" not allowed. Please upload PDF, Word, or text files.` 
            });
        }
        
        // Validate file size (max 10MB)
        const maxSize = 10 * 1024 * 1024;
        if (req.file.size > maxSize) {
            return res.status(400).json({ 
                error: `File size exceeds ${maxSize / (1024 * 1024)}MB limit` 
            });
        }
        
        const { caseContract } = await initContracts();
        const caseData = await caseContract.methods.getCase(caseId).call();
        
        if (!caseData.exists) {
            return res.status(404).json({ error: 'Case not found' });
        }
        
        if (caseData.prosecutorId !== req.user.username) {
            return res.status(403).json({ error: 'You are not assigned to this case' });
        }
        
        if (caseData.isClosed) {
            return res.status(400).json({ error: 'Case is already closed' });
        }
        
        // Upload report to IPFS
        const formData = new FormData();
        formData.append('file', req.file.buffer, req.file.originalname);
        
        let ipfsResponse;
        let retries = 3;
        while (retries > 0) {
            try {
                ipfsResponse = await axios.post('http://127.0.0.1:5001/api/v0/add', formData, { 
                    headers: { ...formData.getHeaders() } 
                });
                break;
            } catch (error) {
                retries--;
                if (retries === 0) throw error;
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        const ipfsHash = ipfsResponse.data.Hash;
        
        // Close case on blockchain with report hash
        await caseContract.methods.closeCaseWithReport(
            caseId,
            ipfsHash,
            req.file.originalname
        ).send({ from: req.address, gas: 3000000 });
        
        res.status(200).json({
            message: 'Case closed successfully with closure report',
            caseId,
            ipfsHash,
            fileName: req.file.originalname,
            description
        });
    } catch (error) {
        console.error('Case Closure Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get case closure report details
app.get('/api/cases/:id/closure-report', authenticateRead, async (req, res) => {
    try {
        const caseId = req.params.id;
        const { caseContract } = await initContracts();
        const caseData = await caseContract.methods.getCase(caseId).call();
        
        if (!caseData.exists) {
            return res.status(404).json({ error: 'Case not found' });
        }
        
        if (!caseData.isClosed) {
            return res.status(400).json({ error: 'Case is not yet closed' });
        }
        
        const report = await caseContract.methods.getCaseClosureReport(caseId).call();
        
        res.json({
            caseId,
            caseNumber: caseData.caseNumber,
            reportHash: report.reportHash,
            reportName: report.reportName,
            closureDate: new Date(Number(report.closureDate) * 1000).toISOString(),
            closedBy: caseData.prosecutorId
        });
    } catch (error) {
        console.error('Closure Report Error:', error);
        res.status(500).json({ error: 'Failed to fetch closure report' });
    }
});

// View closure report file
app.get('/api/cases/:id/closure-report/view', async (req, res) => {
    try {
        const caseId = req.params.id;
        const token = req.query.token;
        
        if (!token) {
            return res.status(401).json({ error: 'Token required' });
        }
        
        const tokenParts = token.split(' ');
        const actualToken = tokenParts.length > 1 ? tokenParts[1] : token;
        let decoded;
        try { 
            decoded = jwt.verify(actualToken, process.env.JWT_SECRET); 
        } catch (err) { 
            return res.status(401).json({ error: 'Invalid or expired token' }); 
        }
        
        const address = decoded.address;
        const { userContract, caseContract } = await initContracts();
        const user = await userContract.methods.getUserByAddress(address).call({ from: address });
        
        if (!user.exists) {
            return res.status(403).json({ error: 'User not registered' });
        }
        
        const caseData = await caseContract.methods.getCase(caseId).call();
        
        if (!caseData.exists) {
            return res.status(404).json({ error: 'Case not found' });
        }
        
        if (!caseData.isClosed) {
            return res.status(400).json({ error: 'Case is not yet closed' });
        }
        
        // Check permissions
        const allowedRoles = ['SuperAdmin', 'StationAdmin', 'Prosecutor', 'Officer', 'Analyst'];
        if (!allowedRoles.includes(user.role)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const report = await caseContract.methods.getCaseClosureReport(caseId).call();
        
        // Get file from IPFS
        const ipfsHash = report.reportHash;
        const localGatewayUrl = `http://127.0.0.1:8080/ipfs/${ipfsHash}`;
        const response = await axios({ 
            method: 'get', 
            url: localGatewayUrl, 
            responseType: 'arraybuffer' 
        });
        
        const fileBuffer = Buffer.from(response.data);
        res.setHeader('Content-Disposition', `inline; filename="${report.reportName}"`);
        res.setHeader('Content-Type', 'application/octet-stream');
        res.send(fileBuffer);
    } catch (error) {
        console.error('View Closure Report Error:', error);
        res.status(500).json({ error: 'Failed to view closure report' });
    }
});

// Download closure report file
app.get('/api/cases/:id/closure-report/download', async (req, res) => {
    try {
        const caseId = req.params.id;
        const token = req.query.token;
        
        if (!token) {
            return res.status(401).json({ error: 'Token required' });
        }
        
        const tokenParts = token.split(' ');
        const actualToken = tokenParts.length > 1 ? tokenParts[1] : token;
        let decoded;
        try { 
            decoded = jwt.verify(actualToken, process.env.JWT_SECRET); 
        } catch (err) { 
            return res.status(401).json({ error: 'Invalid or expired token' }); 
        }
        
        const address = decoded.address;
        const { userContract, caseContract } = await initContracts();
        const user = await userContract.methods.getUserByAddress(address).call({ from: address });
        
        if (!user.exists) {
            return res.status(403).json({ error: 'User not registered' });
        }
        
        const caseData = await caseContract.methods.getCase(caseId).call();
        
        if (!caseData.exists) {
            return res.status(404).json({ error: 'Case not found' });
        }
        
        if (!caseData.isClosed) {
            return res.status(400).json({ error: 'Case is not yet closed' });
        }
        
        // Check permissions
        const allowedRoles = ['SuperAdmin', 'StationAdmin', 'Prosecutor', 'Officer', 'Analyst'];
        if (!allowedRoles.includes(user.role)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const report = await caseContract.methods.getCaseClosureReport(caseId).call();
        
        // Get file from IPFS
        const ipfsHash = report.reportHash;
        const localGatewayUrl = `http://127.0.0.1:8080/ipfs/${ipfsHash}`;
        const response = await axios({ 
            method: 'get', 
            url: localGatewayUrl, 
            responseType: 'arraybuffer' 
        });
        
        const fileBuffer = Buffer.from(response.data);
        res.setHeader('Content-Disposition', `attachment; filename="${report.reportName}"`);
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Length', fileBuffer.length);
        res.send(fileBuffer);
    } catch (error) {
        console.error('Download Closure Report Error:', error);
        res.status(500).json({ error: 'Failed to download closure report' });
    }
});

// ============================================
// CASE CLOSURE REPORT LIST
// ============================================

// Get all closed cases with closure reports
app.get('/api/cases/closed-reports', authenticateRead, async (req, res) => {
    try {
        const { caseContract } = await initContracts();
        
        // Get all closed case IDs from blockchain
        const closedCaseIds = await caseContract.methods.getClosedCaseIds().call();
        
        const reports = [];
        for (let i = 0; i < closedCaseIds.length; i++) {
            const caseId = closedCaseIds[i];
            const caseData = await caseContract.methods.getCase(caseId).call();
            
            // Check if case has closure report
            const hasReport = await caseContract.methods.hasClosureReport(caseId).call();
            
            if (hasReport) {
                const report = await caseContract.methods.getCaseClosureReport(caseId).call();
                reports.push({
                    caseId: caseId,
                    caseNumber: caseData.caseNumber,
                    title: caseData.title,
                    closedBy: caseData.prosecutorId,
                    closureDate: new Date(Number(report.closureDate) * 1000).toISOString(),
                    reportHash: report.reportHash,
                    reportName: report.reportName,
                    description: caseData.description
                });
            }
        }
        
        // Sort by closure date (newest first)
        reports.sort((a, b) => new Date(b.closureDate) - new Date(a.closureDate));
        
        res.json(reports);
    } catch (error) {
        console.error('Closure Reports Error:', error);
        res.status(500).json({ error: 'Failed to fetch closure reports' });
    }
});

// ============================================
// EVIDENCE ROUTES
// ============================================

app.post('/api/evidence/upload', authenticate, allowRoles('Officer'), upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        
        // Add file type validation
        const allowedTypes = [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp',
            'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'video/mp4', 'video/mpeg', 'video/quicktime',
            'audio/mpeg', 'audio/mp4', 'audio/wav',
            'text/plain', 'text/csv', 'application/json',
            'application/zip', 'application/x-rar-compressed'
        ];
        if (!allowedTypes.includes(req.file.mimetype)) {
            return res.status(400).json({ 
                error: `File type "${req.file.mimetype}" not allowed. Allowed types: ${allowedTypes.join(', ')}` 
            });
        }
        
        // Add file size validation (max 50MB)
        const maxSize = 50 * 1024 * 1024; // 50MB
        if (req.file.size > maxSize) {
            return res.status(400).json({ 
                error: `File size exceeds ${maxSize / (1024 * 1024)}MB limit` 
            });
        }
        
        // Validate caseId if provided
        const { caseId, description } = req.body;
        if (caseId && caseId.trim() !== '') {
            const { caseContract } = await initContracts();
            const caseData = await caseContract.methods.getCase(caseId).call();
            if (!caseData.exists) {
                return res.status(400).json({ error: 'Case does not exist' });
            }
        }
        
        // Validate description
        if (!description || !description.trim()) {
            return res.status(400).json({ error: 'Description is required for evidence' });
        }
        if (description.trim().length < 5) {
            return res.status(400).json({ error: 'Description must be at least 5 characters' });
        }
        if (description.trim().length > 1000) {
            return res.status(400).json({ error: 'Description cannot exceed 1000 characters' });
        }
        
        const evidenceId = uuidv4();
        const formData = new FormData();
        formData.append('file', req.file.buffer, req.file.originalname);
        
        // Add retry logic for IPFS upload
        let ipfsResponse;
        let retries = 3;
        while (retries > 0) {
            try {
                ipfsResponse = await axios.post('http://127.0.0.1:5001/api/v0/add', formData, { 
                    headers: { ...formData.getHeaders() } 
                });
                break;
            } catch (error) {
                retries--;
                if (retries === 0) throw error;
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        const ipfsHash = ipfsResponse.data.Hash;
        const { caseContract, evidenceContract } = await initContracts();
        
        await evidenceContract.methods.addEvidence(
            evidenceId, 
            req.file.originalname, 
            description || '', 
            ipfsHash, 
            req.file.mimetype, 
            req.file.size.toString(), 
            req.user.username, 
            caseId || ''
        ).send({ from: req.address, gas: 15000000 });
        
        const logNote = `Officer ${req.user.username} uploaded evidence file "${req.file.originalname}" (${req.file.mimetype}, ${req.file.size} bytes). Description: ${description || 'No description provided'}`;
        await evidenceContract.methods.logAction(evidenceId, req.user.username, "EVIDENCE_UPLOAD", logNote).send({ from: req.address, gas: 5000000 });
        
        res.status(201).json({ 
            message: 'Evidence uploaded successfully', 
            evidenceId, 
            ipfsHash,
            fileName: req.file.originalname,
            fileSize: req.file.size,
            fileType: req.file.mimetype
        });
    } catch (error) {
        console.error('Upload Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/evidence/:id/assign-case', authenticate, allowRoles('Officer'), async (req, res) => {
    try {
        const evidenceId = req.params.id;
        const { caseId } = req.body;
        const { caseContract, evidenceContract } = await initContracts();
        const evidence = await evidenceContract.methods.getEvidence(evidenceId).call();
        if (!evidence.exists) return res.status(404).json({ error: 'Evidence does not exist' });
        if (caseId) { const caseData = await caseContract.methods.getCase(caseId).call(); if (!caseData.exists) return res.status(404).json({ error: 'Case does not exist' }); }
        await evidenceContract.methods.assignEvidenceToCase(evidenceId, caseId || '').send({ from: req.address, gas: 3000000 });
        const updatedEvidence = await evidenceContract.methods.getEvidence(evidenceId).call();
        if (updatedEvidence.caseId !== caseId) throw new Error('Failed to update evidence case assignment on blockchain');
        res.json({ message: 'Case assigned to evidence successfully', evidenceId, caseId, verified: true });
    } catch (error) {
        console.error('Assign Case Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/evidence', authenticateRead, async (req, res) => {
    try {
        const { caseContract, userContract, evidenceContract } = await initContracts();
        const ids = await evidenceContract.methods.getAllEvidenceIds().call();
        const evidenceList = [];
        const allUsers = await userContract.methods.getAllUsers().call();
        const allAddresses = await userContract.methods.getAllUserAddresses().call();
        
        const userStationMap = {};
        for (let i = 0; i < allUsers.length; i++) {
            userStationMap[allUsers[i].username] = allUsers[i].stationId;
        }
        
        const stationId = req.user.stationId;
        let analystCaseIds = [];
        if (req.user.role === 'Analyst') {
            const allCaseIds = await caseContract.methods.getAllCaseIds().call();
            for (let i = 0; i < allCaseIds.length; i++) {
                const caseData = await caseContract.methods.getCase(allCaseIds[i]).call();
                if (caseData.exists && caseData.analystId === req.user.username) {
                    analystCaseIds.push(allCaseIds[i]);
                }
            }
        }
        
        for (let i = 0; i < ids.length; i++) {
            const item = await evidenceContract.methods.getEvidence(ids[i]).call();
            if (item.exists) {
                if (req.user.role === 'Officer' && item.uploaderId !== req.user.username) continue;
                if (req.user.role === 'StationAdmin') {
                    const caseData = await caseContract.methods.getCase(item.caseId).call();
                    if (userStationMap[caseData.createdBy] !== stationId) continue;
                }
                if (req.user.role === 'Prosecutor') {
                    const caseData = await caseContract.methods.getCase(item.caseId).call();
                    if (caseData.prosecutorId !== req.user.username) continue;
                }
                if (req.user.role === 'Analyst') {
                    if (!analystCaseIds.includes(item.caseId)) continue;
                }
                
                evidenceList.push({
                    evidence_id: ids[i],
                    file_name: item.name,
                    description: item.description,
                    ipfsHash: item.ipfsHash,
                    file_type: item.fileType,
                    size: Number(item.size),
                    uploader_id: item.uploaderId,
                    case_id: item.caseId,
                    isCourtReady: item.isCourtReady,
                    isWeak: item.isWeak,
                    isArchived: item.isArchived,
                    timestamp: new Date(Number(item.timestamp) * 1000).toISOString()
                });
            }
        }
        res.json(evidenceList);
    } catch (error) {
        console.error('Fetch Evidence Error:', error);
        res.status(500).json({ error: 'Failed to fetch evidence' });
    }
});

app.get('/api/evidence/:id/view', async (req, res) => {
    try {
        const evidenceId = req.params.id;
        const token = req.query.token;
        const reason = req.query.reason || 'No reason provided';
        if (!token) return res.status(401).json({ error: 'Token required' });
        const tokenParts = token.split(' ');
        const actualToken = tokenParts.length > 1 ? tokenParts[1] : token;
        let decoded;
        try { decoded = jwt.verify(actualToken, process.env.JWT_SECRET); } catch (err) { return res.status(401).json({ error: 'Invalid or expired token' }); }
        const address = decoded.address;
        const { userContract, caseContract, evidenceContract } = await initContracts();
        const user = await userContract.methods.getUserByAddress(address).call({ from: address });
        if (!user.exists) return res.status(403).json({ error: 'User not registered' });
        if (!user.isActive) return res.status(403).json({ error: 'Account disabled' });
        const item = await evidenceContract.methods.getEvidence(evidenceId).call({ from: address });
        if (!item.exists) return res.status(404).json({ error: 'Evidence not found' });
        if (user.role === 'Analyst') { const caseData = await caseContract.methods.getCase(item.caseId).call(); if (caseData.analystId !== user.username) return res.status(403).json({ error: 'Access denied. You are not assigned to this case.' }); }
        const logNote = `Evidence file "${item.name}" (ID: ${evidenceId}) was opened and viewed by ${user.username} (${user.role}). Reason: ${reason}`;
        await evidenceContract.methods.logAction(evidenceId, user.username, "EVIDENCE_VIEW", logNote).send({ from: address, gas: 5000000 });
        const ipfsHash = item.ipfsHash;
        const localGatewayUrl = `http://127.0.0.1:8080/ipfs/${ipfsHash}`;
        const response = await axios({ method: 'get', url: localGatewayUrl, responseType: 'arraybuffer' });
        const fileBuffer = Buffer.from(response.data);
        res.setHeader('Content-Disposition', `inline; filename="${item.name}"`);
        res.setHeader('Content-Type', item.fileType);
        res.send(fileBuffer);
    } catch (error) {
        console.error('View Evidence Error:', error);
        res.status(500).json({ error: 'Failed to view evidence' });
    }
});

// Evidence Download Endpoint
app.get('/api/evidence/:id/download', async (req, res) => {
    try {
        const evidenceId = req.params.id;
        const token = req.query.token;
        const reason = req.query.reason || 'No reason provided';
        
        if (!token) return res.status(401).json({ error: 'Token required' });
        
        const tokenParts = token.split(' ');
        const actualToken = tokenParts.length > 1 ? tokenParts[1] : token;
        let decoded;
        try { 
            decoded = jwt.verify(actualToken, process.env.JWT_SECRET); 
        } catch (err) { 
            return res.status(401).json({ error: 'Invalid or expired token' }); 
        }
        
        const address = decoded.address;
        const { userContract, caseContract, evidenceContract } = await initContracts();
        const user = await userContract.methods.getUserByAddress(address).call({ from: address });
        
        if (!user.exists) return res.status(403).json({ error: 'User not registered' });
        if (!user.isActive) return res.status(403).json({ error: 'Account disabled' });
        
        const item = await evidenceContract.methods.getEvidence(evidenceId).call({ from: address });
        if (!item.exists) return res.status(404).json({ error: 'Evidence not found' });
        
        // Check permissions
        if (user.role === 'Analyst') { 
            const caseData = await caseContract.methods.getCase(item.caseId).call(); 
            if (caseData.analystId !== user.username) {
                return res.status(403).json({ error: 'Access denied. You are not assigned to this case.' });
            }
        }
        
        // Log the download action
        const logNote = `Evidence file "${item.name}" (ID: ${evidenceId}) was downloaded by ${user.username} (${user.role}). Reason: ${reason}`;
        await evidenceContract.methods.logAction(evidenceId, user.username, "EVIDENCE_DOWNLOAD", logNote).send({ from: address, gas: 5000000 });
        
        // Get file from IPFS
        const ipfsHash = item.ipfsHash;
        const localGatewayUrl = `http://127.0.0.1:8080/ipfs/${ipfsHash}`;
        const response = await axios({ 
            method: 'get', 
            url: localGatewayUrl, 
            responseType: 'arraybuffer' 
        });
        
        const fileBuffer = Buffer.from(response.data);
        
        // Set headers for download (attachment)
        res.setHeader('Content-Disposition', `attachment; filename="${item.name}"`);
        res.setHeader('Content-Type', item.fileType);
        res.setHeader('Content-Length', fileBuffer.length);
        res.send(fileBuffer);
    } catch (error) {
        console.error('Download Evidence Error:', error);
        res.status(500).json({ error: 'Failed to download evidence' });
    }
});

// File Verification Endpoint
app.post('/api/evidence/:id/verify', authenticate, async (req, res) => {
    try {
        const evidenceId = req.params.id;
        const { fileHash } = req.body;
        
        if (!fileHash) {
            return res.status(400).json({ error: 'File hash is required for verification' });
        }
        
        const { evidenceContract, userContract } = await initContracts();
        const user = await userContract.methods.getUserByAddress(req.address).call();
        
        // Get evidence from blockchain
        const evidence = await evidenceContract.methods.getEvidence(evidenceId).call();
        if (!evidence.exists) {
            return res.status(404).json({ error: 'Evidence not found' });
        }
        
        // Verify file hash matches blockchain record
        const blockchainHash = evidence.ipfsHash;
        const isMatch = fileHash === blockchainHash;
        
        // Get chain of custody history
        const history = await evidenceContract.methods.getHistory(evidenceId).call();
        const formattedHistory = history.map(log => ({
            action: log.action,
            notes: log.notes,
            actorId: log.actorId,
            timestamp: new Date(Number(log.timestamp) * 1000).toISOString()
        }));
        
        // Log verification action
        const logNote = `Evidence file "${evidence.name}" (ID: ${evidenceId}) was verified by ${user.username} (${user.role}). Result: ${isMatch ? 'PASSED' : 'FAILED'}`;
        await evidenceContract.methods.logAction(evidenceId, user.username, "EVIDENCE_VERIFIED", logNote).send({ from: req.address, gas: 5000000 });
        
        res.json({
            verified: isMatch,
            evidenceId: evidenceId,
            fileName: evidence.name,
            blockchainHash: blockchainHash,
            submittedHash: fileHash,
            matches: isMatch,
            timestamp: new Date().toISOString(),
            verifiedBy: user.username,
            history: formattedHistory,
            message: isMatch ? '✅ File verified successfully. The file matches the blockchain record.' : '❌ File verification failed. The file does not match the blockchain record.'
        });
    } catch (error) {
        console.error('Verify Evidence Error:', error);
        res.status(500).json({ error: 'Failed to verify evidence' });
    }
});

// Supporting Evidence Verification Endpoint
app.post('/api/supporting-evidence/:id/verify', authenticate, async (req, res) => {
    try {
        const supportingId = req.params.id;
        const { fileHash } = req.body;
        
        if (!fileHash) {
            return res.status(400).json({ error: 'File hash is required for verification' });
        }
        
        const { evidenceContract, userContract } = await initContracts();
        const user = await userContract.methods.getUserByAddress(req.address).call();
        
        // Get supporting evidence from blockchain
        const evidence = await evidenceContract.methods.getSupportingEvidence(supportingId).call();
        if (!evidence.exists) {
            return res.status(404).json({ error: 'Supporting evidence not found' });
        }
        
        // Verify file hash matches blockchain record
        const blockchainHash = evidence.ipfsHash;
        const isMatch = fileHash === blockchainHash;
        
        // Get chain of custody history
        const history = await evidenceContract.methods.getSupportingHistory(supportingId).call();
        const formattedHistory = history.map(log => ({
            action: log.action,
            notes: log.notes,
            actorId: log.actorId,
            timestamp: new Date(Number(log.timestamp) * 1000).toISOString()
        }));
        
        // Log verification action
        const logNote = `Supporting evidence file "${evidence.name}" (ID: ${supportingId}) was verified by ${user.username} (${user.role}). Result: ${isMatch ? 'PASSED' : 'FAILED'}`;
        await evidenceContract.methods.logSupportingAction(supportingId, user.username, "SUPPORTING_EVIDENCE_VERIFIED", logNote).send({ from: req.address, gas: 5000000 });
        
        res.json({
            verified: isMatch,
            supportingId: supportingId,
            fileName: evidence.name,
            blockchainHash: blockchainHash,
            submittedHash: fileHash,
            matches: isMatch,
            timestamp: new Date().toISOString(),
            verifiedBy: user.username,
            history: formattedHistory,
            message: isMatch ? '✅ File verified successfully. The file matches the blockchain record.' : '❌ File verification failed. The file does not match the blockchain record.'
        });
    } catch (error) {
        console.error('Verify Supporting Evidence Error:', error);
        res.status(500).json({ error: 'Failed to verify supporting evidence' });
    }
});

// IPFS Hash Calculation Endpoint (for verification)
app.post('/api/ipfs/hash', authenticate, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Prepare file for IPFS
        const formData = new FormData();
        formData.append('file', req.file.buffer, req.file.originalname);

        // Upload to IPFS
        const ipfsResponse = await axios.post('http://127.0.0.1:5001/api/v0/add', formData, {
            headers: { ...formData.getHeaders() },
            maxBodyLength: Infinity,
            maxContentLength: Infinity
        });

        const ipfsHash = ipfsResponse.data.Hash;

        res.json({
            success: true,
            ipfsHash: ipfsHash,
            fileName: req.file.originalname,
            fileSize: req.file.size
        });
    } catch (error) {
        console.error('IPFS Hash Calculation Error:', error);
        res.status(500).json({ 
            error: 'Failed to calculate IPFS hash',
            details: error.message 
        });
    }
});

app.put('/api/evidence/:id/court-ready', authenticate, allowRoles('Prosecutor'), async (req, res) => {
    try {
        const evidenceId = req.params.id;
        const { isCourtReady } = req.body;
        const { evidenceContract } = await initContracts();
        await evidenceContract.methods.markEvidenceCourtReady(evidenceId, isCourtReady).send({ from: req.address, gas: 3000000 });
        res.json({ message: isCourtReady ? 'Evidence marked as Court Ready' : 'Evidence unmarked' });
    } catch (error) {
        console.error('Court Ready Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/evidence/:id/mark-weak', authenticate, allowRoles('Prosecutor'), async (req, res) => {
    try {
        const evidenceId = req.params.id;
        const { isWeak, reason } = req.body;
        if (isWeak && !reason?.trim()) return res.status(400).json({ error: 'Reason required' });
        const { evidenceContract } = await initContracts();
        await evidenceContract.methods.markEvidenceWeak(evidenceId, isWeak, reason || '').send({ from: req.address, gas: 3000000 });
        res.json({ message: isWeak ? 'Evidence marked as Weak' : 'Evidence unmarked' });
    } catch (error) {
        console.error('Mark Weak Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Archive evidence endpoints
app.put('/api/evidence/:id/archive', authenticate, allowRoles('SuperAdmin', 'StationAdmin'), async (req, res) => {
    try {
        const evidenceId = req.params.id;
        const { action } = req.body; // 'archive' or 'restore'
        
        const { evidenceContract } = await initContracts();
        const evidence = await evidenceContract.methods.getEvidence(evidenceId).call();
        if (!evidence.exists) {
            return res.status(404).json({ error: 'Evidence not found' });
        }
        
        if (action === 'archive') {
            await evidenceContract.methods.archiveEvidence(evidenceId).send({ from: req.address, gas: 3000000 });
            res.json({ message: 'Evidence archived successfully' });
        } else if (action === 'restore') {
            await evidenceContract.methods.restoreEvidence(evidenceId).send({ from: req.address, gas: 3000000 });
            res.json({ message: 'Evidence restored successfully' });
        } else {
            res.status(400).json({ error: 'Invalid action. Use "archive" or "restore"' });
        }
    } catch (error) {
        console.error('Archive Evidence Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/supporting-evidence/:id/archive', authenticate, allowRoles('SuperAdmin', 'StationAdmin'), async (req, res) => {
    try {
        const supportingId = req.params.id;
        const { action } = req.body;
        
        const { evidenceContract } = await initContracts();
        const evidence = await evidenceContract.methods.getSupportingEvidence(supportingId).call();
        if (!evidence.exists) {
            return res.status(404).json({ error: 'Supporting evidence not found' });
        }
        
        if (action === 'archive') {
            await evidenceContract.methods.archiveSupportingEvidence(supportingId).send({ from: req.address, gas: 3000000 });
            res.json({ message: 'Supporting evidence archived successfully' });
        } else if (action === 'restore') {
            await evidenceContract.methods.restoreSupportingEvidence(supportingId).send({ from: req.address, gas: 3000000 });
            res.json({ message: 'Supporting evidence restored successfully' });
        } else {
            res.status(400).json({ error: 'Invalid action. Use "archive" or "restore"' });
        }
    } catch (error) {
        console.error('Archive Supporting Evidence Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/evidence/:id/history', authenticateRead, async (req, res) => {
    try {
        const evidenceId = req.params.id;
        const { evidenceContract } = await initContracts();
        const history = await evidenceContract.methods.getHistory(evidenceId).call();
        const formattedHistory = history.map(log => ({ action: log.action, notes: log.notes, actorId: log.actorId, timestamp: new Date(Number(log.timestamp) * 1000).toISOString() }));
        res.json(formattedHistory);
    } catch (error) {
        console.error('Fetch History Error:', error);
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

app.get('/api/evidence/:id/report', authenticateRead, async (req, res) => {
    try {
        const evidenceId = req.params.id;
        const { evidenceContract } = await initContracts();
        const item = await evidenceContract.methods.getEvidence(evidenceId).call();
        if (!item.exists) return res.status(404).json({ error: 'Evidence not found' });
        let uploaderName = item.uploaderId;
        let caseDetails = null;
        if (item.caseId && item.caseId.length > 0) {
            const { caseContract } = await initContracts();
            const caseData = await caseContract.methods.getCase(item.caseId).call();
            if (caseData.exists) caseDetails = { case_id: item.caseId, case_number: caseData.caseNumber, title: caseData.title, description: caseData.description };
        }
        const history = await evidenceContract.methods.getHistory(evidenceId).call();
        const formattedHistory = history.map(log => ({ action: log.action, notes: log.notes, actorId: log.actorId, timestamp: new Date(Number(log.timestamp) * 1000).toISOString() }));
        res.json({ evidenceId: item.id, fileName: item.name, description: item.description, ipfsHash: item.ipfsHash, fileType: item.fileType, size: Number(item.size), case: caseDetails, isCourtReady: item.isCourtReady, isWeak: item.isWeak, uploader: uploaderName, uploadedAt: new Date(Number(item.timestamp) * 1000).toISOString(), history: formattedHistory });
    } catch (error) {
        console.error('Report Error:', error);
        res.status(500).json({ error: 'Failed to generate report' });
    }
});

// ============================================
// SUPPORTING EVIDENCE ROUTES
// ============================================

app.post('/api/supporting-evidence/upload', authenticate, allowRoles('Analyst'), upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        const { caseId, description, evidenceId } = req.body;
        
        if (!caseId) return res.status(400).json({ error: 'Case ID is required' });
        if (!description || !description.trim()) return res.status(400).json({ error: 'Description is required' });
        
        // Verify analyst is assigned to this case
        const { caseContract, evidenceContract, userContract } = await initContracts();
        const caseData = await caseContract.methods.getCase(caseId).call();
        if (!caseData.exists) {
            return res.status(400).json({ error: 'Case does not exist' });
        }
        
        // Check if case has an analyst assigned
        if (!caseData.analystId || caseData.analystId === '') {
            return res.status(403).json({ error: 'This case has no analyst assigned' });
        }
        
        // Check if the current user is the assigned analyst
        if (caseData.analystId !== req.user.username) {
            return res.status(403).json({ error: 'You are not assigned as the analyst for this case' });
        }
        
        const supportingId = uuidv4();
        
        const formData = new FormData();
        formData.append('file', req.file.buffer, req.file.originalname);
        const ipfsResponse = await axios.post('http://127.0.0.1:5001/api/v0/add', formData, { 
            headers: { ...formData.getHeaders() } 
        });
        const ipfsHash = ipfsResponse.data.Hash;
        
        await evidenceContract.methods.addSupportingEvidence(
            supportingId,
            req.file.originalname,
            description,
            ipfsHash,
            req.file.mimetype,
            req.file.size.toString(),
            req.user.username,
            caseId,
            evidenceId || ''
        ).send({ from: req.address, gas: 15000000 });
        
        res.status(201).json({ 
            message: 'Supporting evidence uploaded successfully', 
            supportingId, 
            ipfsHash 
        });
    } catch (error) {
        console.error('Upload Supporting Evidence Error:', error);
        // Check for specific error messages from the contract
        if (error.message.includes('NA')) {
            res.status(403).json({ error: 'You are not authorized as an Analyst' });
        } else if (error.message.includes('NAC')) {
            res.status(403).json({ error: 'You are not assigned as the analyst for this case' });
        } else if (error.message.includes('CD')) {
            res.status(400).json({ error: 'Case does not exist' });
        } else if (error.message.includes('SI')) {
            res.status(400).json({ error: 'Supporting evidence ID already exists' });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

app.get('/api/supporting-evidence', authenticateRead, async (req, res) => {
    try {
        const { caseContract, userContract, evidenceContract } = await initContracts();
        const ids = await evidenceContract.methods.getAllSupportingEvidenceIds().call();
        const supportingList = [];
        
        const allUsers = await userContract.methods.getAllUsers().call();
        const userStationMap = {};
        for (let i = 0; i < allUsers.length; i++) {
            userStationMap[allUsers[i].username] = allUsers[i].stationId;
        }
        
        const stationId = req.user.stationId;
        let analystCaseIds = [];
        
        if (req.user.role === 'Analyst') {
            const allCaseIds = await caseContract.methods.getAllCaseIds().call();
            for (let i = 0; i < allCaseIds.length; i++) {
                const caseData = await caseContract.methods.getCase(allCaseIds[i]).call();
                if (caseData.exists && caseData.analystId === req.user.username) {
                    analystCaseIds.push(allCaseIds[i]);
                }
            }
        }
        
        for (let i = 0; i < ids.length; i++) {
            const item = await evidenceContract.methods.getSupportingEvidence(ids[i]).call();
            if (item.exists) {
                if (req.user.role === 'SuperAdmin') {
                    // SuperAdmin sees all
                } else if (req.user.role === 'StationAdmin') {
                    const caseData = await caseContract.methods.getCase(item.caseId).call();
                    if (userStationMap[caseData.createdBy] !== stationId) continue;
                } else if (req.user.role === 'Officer') {
                    const caseData = await caseContract.methods.getCase(item.caseId).call();
                    if (caseData.createdBy !== req.user.username) continue;
                } else if (req.user.role === 'Prosecutor') {
                    const caseData = await caseContract.methods.getCase(item.caseId).call();
                    if (caseData.prosecutorId !== req.user.username) continue;
                } else if (req.user.role === 'Analyst') {
                    if (!analystCaseIds.includes(item.caseId)) continue;
                }
                
                let caseTitle = 'No Case Assigned';
                let caseNumber = 'N/A';
                try {
                    const caseData = await caseContract.methods.getCase(item.caseId).call();
                    if (caseData.exists) {
                        caseTitle = caseData.title || 'Untitled';
                        caseNumber = caseData.caseNumber || 'N/A';
                    }
                } catch (e) {}
                
                supportingList.push({
                    supporting_id: ids[i],
                    file_name: item.name,
                    description: item.description,
                    ipfsHash: item.ipfsHash,
                    file_type: item.fileType,
                    size: Number(item.size),
                    uploader_id: item.uploaderId,
                    case_id: item.caseId,
                    evidence_id: item.evidenceId,
                    case_title: caseTitle,
                    case_number: caseNumber,
                    isArchived: item.isArchived,
                    timestamp: new Date(Number(item.timestamp) * 1000).toISOString()
                });
            }
        }
        
        res.json(supportingList);
    } catch (error) {
        console.error('Fetch Supporting Evidence Error:', error);
        res.status(500).json({ error: 'Failed to fetch supporting evidence' });
    }
});

app.get('/api/supporting-evidence/:id/view', async (req, res) => {
    try {
        const supportingId = req.params.id;
        const token = req.query.token;
        const reason = req.query.reason || 'No reason provided';
        
        if (!token) return res.status(401).json({ error: 'Token required' });
        
        const tokenParts = token.split(' ');
        const actualToken = tokenParts.length > 1 ? tokenParts[1] : token;
        let decoded;
        try { 
            decoded = jwt.verify(actualToken, process.env.JWT_SECRET); 
        } catch (err) { 
            return res.status(401).json({ error: 'Invalid or expired token' }); 
        }
        
        const address = decoded.address;
        const { userContract, caseContract, evidenceContract } = await initContracts();
        const user = await userContract.methods.getUserByAddress(address).call({ from: address });
        
        if (!user.exists) return res.status(403).json({ error: 'User not registered' });
        if (!user.isActive) return res.status(403).json({ error: 'Account disabled' });
        
        const item = await evidenceContract.methods.getSupportingEvidence(supportingId).call({ from: address });
        if (!item.exists) return res.status(404).json({ error: 'Supporting evidence not found' });
        
        if (user.role === 'Analyst') {
            const caseData = await caseContract.methods.getCase(item.caseId).call();
            if (caseData.analystId !== user.username) {
                return res.status(403).json({ error: 'Access denied. You are not assigned to this case.' });
            }
        } else if (user.role === 'Officer') {
            const caseData = await caseContract.methods.getCase(item.caseId).call();
            if (caseData.createdBy !== user.username) {
                return res.status(403).json({ error: 'Access denied. You did not create this case.' });
            }
        } else if (user.role === 'Prosecutor') {
            const caseData = await caseContract.methods.getCase(item.caseId).call();
            if (caseData.prosecutorId !== user.username) {
                return res.status(403).json({ error: 'Access denied. You are not assigned to this case.' });
            }
        }
        
        const logNote = `Supporting evidence file "${item.name}" (ID: ${supportingId}) was opened and viewed by ${user.username} (${user.role}). Reason: ${reason}`;
        await evidenceContract.methods.logSupportingAction(
            supportingId, 
            user.username, 
            "SUPPORTING_EVIDENCE_VIEW", 
            logNote
        ).send({ from: address, gas: 5000000 });
        
        const ipfsHash = item.ipfsHash;
        const localGatewayUrl = `http://127.0.0.1:8080/ipfs/${ipfsHash}`;
        const response = await axios({ 
            method: 'get', 
            url: localGatewayUrl, 
            responseType: 'arraybuffer' 
        });
        
        const fileBuffer = Buffer.from(response.data);
        res.setHeader('Content-Disposition', `inline; filename="${item.name}"`);
        res.setHeader('Content-Type', item.fileType);
        res.send(fileBuffer);
    } catch (error) {
        console.error('View Supporting Evidence Error:', error);
        res.status(500).json({ error: 'Failed to view supporting evidence' });
    }
});

// Supporting Evidence Download Endpoint
app.get('/api/supporting-evidence/:id/download', async (req, res) => {
    try {
        const supportingId = req.params.id;
        const token = req.query.token;
        const reason = req.query.reason || 'No reason provided';
        
        if (!token) return res.status(401).json({ error: 'Token required' });
        
        const tokenParts = token.split(' ');
        const actualToken = tokenParts.length > 1 ? tokenParts[1] : token;
        let decoded;
        try { 
            decoded = jwt.verify(actualToken, process.env.JWT_SECRET); 
        } catch (err) { 
            return res.status(401).json({ error: 'Invalid or expired token' }); 
        }
        
        const address = decoded.address;
        const { userContract, caseContract, evidenceContract } = await initContracts();
        const user = await userContract.methods.getUserByAddress(address).call({ from: address });
        
        if (!user.exists) return res.status(403).json({ error: 'User not registered' });
        if (!user.isActive) return res.status(403).json({ error: 'Account disabled' });
        
        const item = await evidenceContract.methods.getSupportingEvidence(supportingId).call({ from: address });
        if (!item.exists) return res.status(404).json({ error: 'Supporting evidence not found' });
        
        // Check permissions
        if (user.role === 'Analyst') {
            const caseData = await caseContract.methods.getCase(item.caseId).call();
            if (caseData.analystId !== user.username) {
                return res.status(403).json({ error: 'Access denied. You are not assigned to this case.' });
            }
        } else if (user.role === 'Officer') {
            const caseData = await caseContract.methods.getCase(item.caseId).call();
            if (caseData.createdBy !== user.username) {
                return res.status(403).json({ error: 'Access denied. You did not create this case.' });
            }
        } else if (user.role === 'Prosecutor') {
            const caseData = await caseContract.methods.getCase(item.caseId).call();
            if (caseData.prosecutorId !== user.username) {
                return res.status(403).json({ error: 'Access denied. You are not assigned to this case.' });
            }
        }
        
        // Log the download action
        const logNote = `Supporting evidence file "${item.name}" (ID: ${supportingId}) was downloaded by ${user.username} (${user.role}). Reason: ${reason}`;
        await evidenceContract.methods.logSupportingAction(
            supportingId, 
            user.username, 
            "SUPPORTING_EVIDENCE_DOWNLOAD", 
            logNote
        ).send({ from: address, gas: 5000000 });
        
        // Get file from IPFS
        const ipfsHash = item.ipfsHash;
        const localGatewayUrl = `http://127.0.0.1:8080/ipfs/${ipfsHash}`;
        const response = await axios({ 
            method: 'get', 
            url: localGatewayUrl, 
            responseType: 'arraybuffer' 
        });
        
        const fileBuffer = Buffer.from(response.data);
        
        // Set headers for download (attachment)
        res.setHeader('Content-Disposition', `attachment; filename="${item.name}"`);
        res.setHeader('Content-Type', item.fileType);
        res.setHeader('Content-Length', fileBuffer.length);
        res.send(fileBuffer);
    } catch (error) {
        console.error('Download Supporting Evidence Error:', error);
        res.status(500).json({ error: 'Failed to download supporting evidence' });
    }
});

// ============================================
// AUDIT LOGS
// ============================================

app.get('/api/admin/audit-logs', authenticate, async (req, res) => {
    try {
        const { caseContract, userContract, evidenceContract } = await initContracts();
        const ids = await evidenceContract.methods.getAllEvidenceIds().call();
        const supportingIds = await evidenceContract.methods.getAllSupportingEvidenceIds().call();
        
        const allUsers = await userContract.methods.getAllUsers().call();
        const allAddresses = await userContract.methods.getAllUserAddresses().call();
        
        const userStationMap = {};
        for (let i = 0; i < allUsers.length; i++) {
            userStationMap[allUsers[i].username] = allUsers[i].stationId;
        }
        
        let allLogs = [];
        const stationId = req.user.stationId;
        
        for (let i = 0; i < ids.length; i++) {
            try {
                const history = await evidenceContract.methods.getHistory(ids[i]).call();
                const evidence = await evidenceContract.methods.getEvidence(ids[i]).call();
                const caseData = await caseContract.methods.getCase(evidence.caseId).call();
                if (req.user.role === 'StationAdmin') {
                    if (userStationMap[caseData.createdBy] !== stationId) continue;
                }
                const formattedHistory = history.map(log => ({
                    evidenceId: ids[i],
                    actorId: log.actorId,
                    action: log.action,
                    notes: log.notes,
                    timestamp: new Date(Number(log.timestamp) * 1000).toISOString()
                }));
                allLogs = allLogs.concat(formattedHistory);
            } catch (e) {}
        }
        
        for (let i = 0; i < supportingIds.length; i++) {
            try {
                const history = await evidenceContract.methods.getSupportingHistory(supportingIds[i]).call();
                const supporting = await evidenceContract.methods.getSupportingEvidence(supportingIds[i]).call();
                const caseData = await caseContract.methods.getCase(supporting.caseId).call();
                if (req.user.role === 'StationAdmin') {
                    if (userStationMap[caseData.createdBy] !== stationId) continue;
                }
                const formattedHistory = history.map(log => ({
                    evidenceId: supportingIds[i],
                    actorId: log.actorId,
                    action: log.action,
                    notes: log.notes,
                    timestamp: new Date(Number(log.timestamp) * 1000).toISOString()
                }));
                allLogs = allLogs.concat(formattedHistory);
            } catch (e) {}
        }
        
        if (req.user.role === 'StationAdmin') {
            allLogs = allLogs.filter(log => userStationMap[log.actorId] === stationId);
        }
        
        allLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        res.json(allLogs);
    } catch (error) {
        console.error('Fetch Audit Logs Error:', error);
        res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
});

// ============================================
// AUDIT TRAIL EXPORT (PDF/CSV)
// ============================================

app.post('/api/admin/audit/export', authenticate, async (req, res) => {
    try {
        const { from, to, actionFilter, format = 'pdf' } = req.body;
        const { caseContract, userContract, evidenceContract } = await initContracts();
        
        // Get all audit logs
        const ids = await evidenceContract.methods.getAllEvidenceIds().call();
        const supportingIds = await evidenceContract.methods.getAllSupportingEvidenceIds().call();
        
        const allUsers = await userContract.methods.getAllUsers().call();
        const allAddresses = await userContract.methods.getAllUserAddresses().call();
        const userStationMap = {};
        for (let i = 0; i < allUsers.length; i++) {
            userStationMap[allUsers[i].username] = allUsers[i].stationId;
        }
        
        let allLogs = [];
        const stationId = req.user.stationId;
        
        // Collect evidence logs
        for (let i = 0; i < ids.length; i++) {
            try {
                const history = await evidenceContract.methods.getHistory(ids[i]).call();
                const evidence = await evidenceContract.methods.getEvidence(ids[i]).call();
                const caseData = await caseContract.methods.getCase(evidence.caseId).call();
                if (req.user.role === 'StationAdmin') {
                    if (userStationMap[caseData.createdBy] !== stationId) continue;
                }
                const formattedHistory = history.map(log => ({
                    evidenceId: ids[i],
                    actorId: log.actorId,
                    action: log.action,
                    notes: log.notes,
                    timestamp: new Date(Number(log.timestamp) * 1000).toISOString(),
                    fileName: evidence.name,
                    caseNumber: caseData.caseNumber
                }));
                allLogs = allLogs.concat(formattedHistory);
            } catch (e) {}
        }
        
        // Collect supporting evidence logs
        for (let i = 0; i < supportingIds.length; i++) {
            try {
                const history = await evidenceContract.methods.getSupportingHistory(supportingIds[i]).call();
                const supporting = await evidenceContract.methods.getSupportingEvidence(supportingIds[i]).call();
                const caseData = await caseContract.methods.getCase(supporting.caseId).call();
                if (req.user.role === 'StationAdmin') {
                    if (userStationMap[caseData.createdBy] !== stationId) continue;
                }
                const formattedHistory = history.map(log => ({
                    evidenceId: supportingIds[i],
                    actorId: log.actorId,
                    action: log.action,
                    notes: log.notes,
                    timestamp: new Date(Number(log.timestamp) * 1000).toISOString(),
                    fileName: supporting.name,
                    caseNumber: caseData.caseNumber
                }));
                allLogs = allLogs.concat(formattedHistory);
            } catch (e) {}
        }
        
        // Apply filters
        if (from) {
            const fromDate = new Date(from);
            allLogs = allLogs.filter(log => new Date(log.timestamp) >= fromDate);
        }
        if (to) {
            const toDate = new Date(to);
            allLogs = allLogs.filter(log => new Date(log.timestamp) <= toDate);
        }
        if (actionFilter) {
            allLogs = allLogs.filter(log => log.action === actionFilter);
        }
        if (req.user.role === 'StationAdmin') {
            allLogs = allLogs.filter(log => userStationMap[log.actorId] === stationId);
        }
        
        // Sort by timestamp (newest first)
        allLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        // Generate PDF
        if (format === 'pdf') {
            const doc = new PDFDocument({ margin: 40 });
            
            // Set response headers
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=audit_trail_${new Date().toISOString().split('T')[0]}.pdf`);
            doc.pipe(res);
            
            // Header
            doc.fillColor('#0f3460')
               .fontSize(20)
               .font('Helvetica-Bold')
               .text('CRIMINAL EVIDENCE CHAIN OF CUSTODY', 40, 40, { align: 'center' })
               .fontSize(12)
               .font('Helvetica')
               .text('Audit Trail Report', { align: 'center' })
               .moveDown();
            
            // Meta info
            doc.fillColor('#444')
               .fontSize(10)
               .text(`Generated: ${new Date().toLocaleString()}`, 40, 90)
               .text(`Generated By: ${req.user.username} (${req.user.role})`, 40, 105)
               .text(`Total Records: ${allLogs.length}`, 40, 120);
            
            if (from || to) {
                const dateRange = `Date Range: ${from || 'Start'} to ${to || 'End'}`;
                doc.text(dateRange, 40, 135);
            }
            
            doc.moveDown().moveDown();
            
            // Table header
            const tableTop = 170;
            const rowHeight = 25;
            const colWidths = [30, 80, 100, 250, 100];
            const colX = [40, 70, 150, 250, 500];
            
            doc.fillColor('#0f3460')
               .fontSize(9)
               .font('Helvetica-Bold');
            
            // Draw header row
            doc.rect(40, tableTop - 5, 500, 30).fill('#0f3460');
            doc.fillColor('white');
            doc.text('#', colX[0] + 15, tableTop + 7);
            doc.text('Action', colX[1] + 5, tableTop + 7);
            doc.text('File', colX[2] + 5, tableTop + 7);
            doc.text('Notes', colX[3] + 5, tableTop + 7);
            doc.text('Timestamp', colX[4] + 5, tableTop + 7);
            
            // Draw table rows
            doc.font('Helvetica').fontSize(8).fillColor('#333');
            
            let y = tableTop + 30;
            let page = 1;
            
            allLogs.forEach((log, index) => {
                // Check if we need a new page
                if (y > 700) {
                    doc.addPage();
                    y = 50;
                    page++;
                    
                    // Draw header on new page
                    doc.fillColor('#0f3460')
                       .fontSize(9)
                       .font('Helvetica-Bold');
                    doc.rect(40, y - 5, 500, 30).fill('#0f3460');
                    doc.fillColor('white');
                    doc.text('#', colX[0] + 15, y + 7);
                    doc.text('Action', colX[1] + 5, y + 7);
                    doc.text('File', colX[2] + 5, y + 7);
                    doc.text('Notes', colX[3] + 5, y + 7);
                    doc.text('Timestamp', colX[4] + 5, y + 7);
                    y += 30;
                    doc.font('Helvetica').fontSize(8).fillColor('#333');
                }
                
                // Truncate long notes
                let notes = log.notes || '';
                if (notes.length > 50) notes = notes.substring(0, 50) + '...';
                
                // Draw row
                doc.text((index + 1).toString(), colX[0] + 15, y + 2, { width: 20, align: 'center' });
                doc.text(log.action || '', colX[1] + 5, y + 2, { width: 70 });
                const fileName = log.fileName || 'N/A';
                doc.text(fileName.length > 20 ? fileName.substring(0, 20) + '...' : fileName, colX[2] + 5, y + 2, { width: 90 });
                doc.text(notes, colX[3] + 5, y + 2, { width: 240 });
                const timestamp = new Date(log.timestamp).toLocaleString();
                doc.text(timestamp, colX[4] + 5, y + 2, { width: 90 });
                
                y += rowHeight;
            });
            
            // Footer
            doc.fillColor('#888')
               .fontSize(8)
               .text(`Page ${page} - Audit Trail Report`, 40, 750, { align: 'center' })
               .text(`Report ID: ${Date.now()}`, 40, 762, { align: 'center' });
            
            doc.end();
        } else if (format === 'csv') {
            // CSV export
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=audit_trail_${new Date().toISOString().split('T')[0]}.csv`);
            
            // CSV header
            let csv = 'Index,Action,File,Notes,Timestamp,Evidence ID,Case Number,Actor ID\n';
            
            // CSV rows
            allLogs.forEach((log, index) => {
                const row = [
                    index + 1,
                    `"${log.action || ''}"`,
                    `"${log.fileName || ''}"`,
                    `"${(log.notes || '').replace(/"/g, '""')}"`,
                    `"${log.timestamp}"`,
                    `"${log.evidenceId || ''}"`,
                    `"${log.caseNumber || ''}"`,
                    `"${log.actorId || ''}"`
                ].join(',');
                csv += row + '\n';
            });
            
            res.send(csv);
        }
    } catch (error) {
        console.error('Audit Export Error:', error);
        res.status(500).json({ error: 'Failed to export audit trail' });
    }
});

// ============================================
// DASHBOARD ROUTES
// ============================================

app.get('/api/dashboard/admin', authenticate, allowRoles('SuperAdmin', 'StationAdmin'), async (req, res) => {
    try {
        const { caseContract, userContract, evidenceContract, crimeContract } = await initContracts();
        
        // Get evidence count
        const evidenceIds = await evidenceContract.methods.getAllEvidenceIds().call();
        const evidenceList = [];
        let fileTypes = {};
        
        const allUsers = await userContract.methods.getAllUsers().call();
        const allAddresses = await userContract.methods.getAllUserAddresses().call();
        const userStationMap = {};
        for (let i = 0; i < allUsers.length; i++) {
            userStationMap[allUsers[i].username] = allUsers[i].stationId;
        }
        
        const stationId = req.user.stationId;
        
        // Process evidence data
        for (let i = 0; i < evidenceIds.length; i++) {
            const item = await evidenceContract.methods.getEvidence(evidenceIds[i]).call();
            if (item.exists) {
                if (req.user.role === 'StationAdmin') {
                    const caseData = await caseContract.methods.getCase(item.caseId).call();
                    if (userStationMap[caseData.createdBy] !== stationId) continue;
                }
                evidenceList.push(item);
                const fileType = item.fileType || 'unknown';
                fileTypes[fileType] = (fileTypes[fileType] || 0) + 1;
            }
        }
        
        // Get case count
        const caseIds = await caseContract.methods.getAllCaseIds().call();
        let caseCount = 0;
        const crimeVsCases = [];
        const crimeMap = {};
        
        for (let i = 0; i < caseIds.length; i++) {
            const caseData = await caseContract.methods.getCase(caseIds[i]).call();
            if (caseData.exists) {
                if (req.user.role === 'StationAdmin') {
                    if (userStationMap[caseData.createdBy] === stationId) {
                        caseCount++;
                        // Track crime vs cases
                        const crimeId = caseData.crimeId;
                        if (crimeId) {
                            if (!crimeMap[crimeId]) {
                                crimeMap[crimeId] = { cases: 0, crimeName: caseData.crimeId };
                                // Try to get crime name
                                try {
                                    const crime = await crimeContract.methods.getCrime(crimeId).call();
                                    if (crime.exists) {
                                        crimeMap[crimeId].crimeName = crime.name;
                                    }
                                } catch (e) {}
                            }
                            crimeMap[crimeId].cases++;
                        }
                    }
                } else {
                    caseCount++;
                    const crimeId = caseData.crimeId;
                    if (crimeId) {
                        if (!crimeMap[crimeId]) {
                            crimeMap[crimeId] = { cases: 0, crimeName: caseData.crimeId };
                            try {
                                const crime = await crimeContract.methods.getCrime(crimeId).call();
                                if (crime.exists) {
                                    crimeMap[crimeId].crimeName = crime.name;
                                }
                            } catch (e) {}
                        }
                        crimeMap[crimeId].cases++;
                    }
                }
            }
        }
        
        // Get crime count
        const crimeIds = await crimeContract.methods.getAllCrimeIds().call();
        let crimeCount = 0;
        for (let i = 0; i < crimeIds.length; i++) {
            const crime = await crimeContract.methods.getCrime(crimeIds[i]).call();
            if (crime.exists) {
                crimeCount++;
            }
        }
        
        // Build crime vs cases data
        for (const [crimeId, data] of Object.entries(crimeMap)) {
            crimeVsCases.push({
                name: data.crimeName.length > 20 ? data.crimeName.substring(0, 20) + '...' : data.crimeName,
                crimes: 1, // Each crime type counts as 1
                cases: data.cases
            });
        }
        
        // Sort by cases descending
        crimeVsCases.sort((a, b) => b.cases - a.cases);
        
        // Limit to top 10
        const topCrimeVsCases = crimeVsCases.slice(0, 10);
        
        // Get station count (SuperAdmin only)
        let stationCount = 0;
        if (req.user.role === 'SuperAdmin') {
            const stationIds = await userContract.methods.getStationIds().call();
            stationCount = stationIds.length;
        }
        
        // Calculate user count
        let userCount = 0;
        let userCountFiltered = 0;
        for (let i = 0; i < allAddresses.length; i++) {
            const userData = allUsers[i];
            // Only count active users
            if (userData.isActive) {
                if (req.user.role === 'StationAdmin') {
                    // For StationAdmin, count only users in their station
                    if (userData.stationId === stationId) {
                        userCountFiltered++;
                    }
                } else {
                    // For SuperAdmin, count all users
                    userCount++;
                }
            }
        }
        
        // For SuperAdmin, use total count; for StationAdmin, use filtered count
        const finalUserCount = req.user.role === 'SuperAdmin' ? userCount : userCountFiltered;
        
        // Format file types for chart
        const fileTypesArray = Object.keys(fileTypes).map(key => ({
            name: key.split('/').pop() || key,
            value: fileTypes[key]
        }));
        
        res.json({
            evidenceCount: evidenceList.length,
            fileTypes: fileTypesArray,
            caseCount: caseCount,
            stationCount: stationCount,
            crimeCount: crimeCount,
            crimeVsCases: topCrimeVsCases,
            userCount: finalUserCount
        });
    } catch (error) {
        console.error('Fetch Admin Dashboard Error:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
});

app.get('/api/dashboard/prosecutor', authenticate, allowRoles('Prosecutor'), async (req, res) => {
    try {
        const { caseContract, evidenceContract } = await initContracts();
        const evidenceIds = await evidenceContract.methods.getAllEvidenceIds().call();
        let totalEvidenceCount = 0;
        let courtReady = 0;
        let weak = 0;
        let pending = 0;
        
        for (let i = 0; i < evidenceIds.length; i++) {
            const item = await evidenceContract.methods.getEvidence(evidenceIds[i]).call();
            if (item.exists) {
                const caseData = await caseContract.methods.getCase(item.caseId).call();
                if (caseData.exists && caseData.prosecutorId === req.user.username) {
                    totalEvidenceCount++;
                    if (item.isCourtReady) {
                        courtReady++;
                    } else if (item.isWeak) {
                        weak++;
                    } else {
                        pending++;
                    }
                }
            }
        }
        
        res.json({
            evidenceCount: totalEvidenceCount,
            courtReadiness: {
                courtReady: courtReady,
                weak: weak,
                pending: pending
            }
        });
    } catch (error) {
        console.error('Fetch Prosecutor Dashboard Error:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
});

app.get('/api/dashboard/officer', authenticate, allowRoles('Officer'), async (req, res) => {
    try {
        const { caseContract, evidenceContract } = await initContracts();
        const evidenceIds = await evidenceContract.methods.getAllEvidenceIds().call();
        let myUploads = [];
        let caseCount = 0;
        
        // Get officer's cases
        const caseIds = await caseContract.methods.getAllCaseIds().call();
        for (let i = 0; i < caseIds.length; i++) {
            const caseData = await caseContract.methods.getCase(caseIds[i]).call();
            if (caseData.exists && caseData.createdBy === req.user.username) {
                caseCount++;
            }
        }
        
        // Get officer's evidence uploads
        for (let i = 0; i < evidenceIds.length; i++) {
            const item = await evidenceContract.methods.getEvidence(evidenceIds[i]).call();
            if (item.exists && item.uploaderId === req.user.username) {
                myUploads.push({
                    name: item.name,
                    size: Number(item.size),
                    timestamp: new Date(Number(item.timestamp) * 1000)
                });
            }
        }
        
        // Sort by timestamp
        myUploads.sort((a, b) => a.timestamp - b.timestamp);
        
        // Calculate weekly uploads for chart
        const weeklyUploads = [];
        const now = new Date();
        for (let i = 6; i >= 0; i--) {
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - i * 7);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 7);
            
            const count = myUploads.filter(u => 
                u.timestamp >= weekStart && u.timestamp < weekEnd
            ).length;
            
            weeklyUploads.push({
                week: `Week ${7 - i}`,
                count: count
            });
        }
        
        res.json({
            evidenceCount: myUploads.length,
            caseCount: caseCount,
            fileSizes: myUploads.map(u => ({
                name: u.name,
                size: Number((u.size / (1024 * 1024)).toFixed(2))
            })),
            weeklyUploads: weeklyUploads
        });
    } catch (error) {
        console.error('Fetch Officer Dashboard Error:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
});

app.get('/api/dashboard/analyst', authenticate, allowRoles('Analyst'), async (req, res) => {
    try {
        const { caseContract, evidenceContract } = await initContracts();
        const allCaseIds = await caseContract.methods.getAllCaseIds().call();
        let analystCaseIds = [];
        
        // Get cases assigned to this analyst
        for (let i = 0; i < allCaseIds.length; i++) {
            const caseData = await caseContract.methods.getCase(allCaseIds[i]).call();
            if (caseData.exists && caseData.analystId === req.user.username) {
                analystCaseIds.push(allCaseIds[i]);
            }
        }
        
        // Count evidence per case and total
        const allEvidenceIds = await evidenceContract.methods.getAllEvidenceIds().call();
        let evidencePerCase = [];
        let totalEvidenceCount = 0;
        let weakEvidenceCount = 0;
        let courtReadyCount = 0;
        let pendingReviewCount = 0;
        let timeline = [];
        
        for (let i = 0; i < analystCaseIds.length; i++) {
            let count = 0;
            let weakCount = 0;
            let courtReady = 0;
            let pending = 0;
            
            for (let j = 0; j < allEvidenceIds.length; j++) {
                const evidence = await evidenceContract.methods.getEvidence(allEvidenceIds[j]).call();
                if (evidence.exists && evidence.caseId === analystCaseIds[i]) {
                    count++;
                    totalEvidenceCount++;
                    if (evidence.isWeak) {
                        weakCount++;
                        weakEvidenceCount++;
                    }
                    if (evidence.isCourtReady) {
                        courtReady++;
                        courtReadyCount++;
                    } else if (!evidence.isWeak) {
                        pending++;
                        pendingReviewCount++;
                    }
                }
            }
            
            const caseData = await caseContract.methods.getCase(analystCaseIds[i]).call();
            evidencePerCase.push({ 
                caseNumber: caseData.caseNumber || 'N/A', 
                title: caseData.title || 'Untitled',
                count,
                weakCount,
                courtReady,
                pending
            });
            
            timeline.push({
                caseNumber: caseData.caseNumber || 'N/A',
                title: caseData.title || 'Untitled',
                assignedAt: new Date(Number(caseData.timestamp) * 1000).toISOString(),
                status: caseData.isClosed ? 'Closed' : 'Active'
            });
        }
        
        // Sort timeline by assigned date (newest first)
        timeline.sort((a, b) => new Date(b.assignedAt) - new Date(a.assignedAt));
        
        // Count supporting evidence
        const allSupportingIds = await evidenceContract.methods.getAllSupportingEvidenceIds().call();
        let supportingEvidenceCount = 0;
        let myUploadsCount = 0;
        
        for (let i = 0; i < allSupportingIds.length; i++) {
            const item = await evidenceContract.methods.getSupportingEvidence(allSupportingIds[i]).call();
            if (item.exists) {
                if (analystCaseIds.includes(item.caseId)) {
                    supportingEvidenceCount++;
                }
                if (item.uploaderId === req.user.username) {
                    myUploadsCount++;
                }
            }
        }
        
        res.json({
            evidenceCount: totalEvidenceCount,
            supportingEvidenceCount: supportingEvidenceCount,
            weakEvidenceCount: weakEvidenceCount,
            courtReadyCount: courtReadyCount,
            pendingReviewCount: pendingReviewCount,
            myUploadsCount: myUploadsCount,
            evidencePerCase: evidencePerCase,
            caseCount: analystCaseIds.length,
            assignedCases: analystCaseIds.length,
            timeline: timeline.slice(0, 10) // Last 10 assignments
        });
    } catch (error) {
        console.error('Fetch Analyst Dashboard Error:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
});

// ============================================
// ROLE-BASED ANALYTICS
// ============================================

app.get('/api/analytics', authenticate, async (req, res) => {
    try {
        console.log(`📊 Fetching analytics for user: ${req.user.username} (${req.user.role})`);
        
        const { caseContract, userContract, evidenceContract, crimeContract } = await initContracts();
        
        // Get all evidence
        const evidenceIds = await evidenceContract.methods.getAllEvidenceIds().call();
        console.log(`📊 Found ${evidenceIds.length} evidence records`);
        
        const evidenceList = [];
        const allUsers = await userContract.methods.getAllUsers().call();
        const allAddresses = await userContract.methods.getAllUserAddresses().call();
        const userStationMap = {};
        for (let i = 0; i < allUsers.length; i++) {
            userStationMap[allUsers[i].username] = allUsers[i].stationId;
        }
        
        const stationId = req.user.stationId;
        
        // Collect evidence data with role-based filtering
        for (let i = 0; i < evidenceIds.length; i++) {
            try {
                const item = await evidenceContract.methods.getEvidence(evidenceIds[i]).call();
                if (item.exists) {
                    // Apply role-based filtering
                    if (req.user.role === 'StationAdmin') {
                        const caseData = await caseContract.methods.getCase(item.caseId).call();
                        if (userStationMap[caseData.createdBy] !== stationId) continue;
                    } else if (req.user.role === 'Officer') {
                        if (item.uploaderId !== req.user.username) continue;
                    } else if (req.user.role === 'Prosecutor') {
                        const caseData = await caseContract.methods.getCase(item.caseId).call();
                        if (caseData.prosecutorId !== req.user.username) continue;
                    } else if (req.user.role === 'Analyst') {
                        const caseData = await caseContract.methods.getCase(item.caseId).call();
                        if (caseData.analystId !== req.user.username) continue;
                    }
                    
                    evidenceList.push({
                        id: evidenceIds[i],
                        name: item.name,
                        fileType: item.fileType,
                        size: Number(item.size),
                        timestamp: Number(item.timestamp),
                        uploader: item.uploaderId,
                        caseId: item.caseId,
                        isCourtReady: item.isCourtReady,
                        isWeak: item.isWeak,
                        isArchived: item.isArchived
                    });
                }
            } catch (e) {
                console.warn(`⚠️ Error processing evidence ${evidenceIds[i]}:`, e.message);
            }
        }
        
        console.log(`📊 Filtered evidence: ${evidenceList.length} records`);
        
        // Get all cases with role-based filtering
        const caseIds = await caseContract.methods.getAllCaseIds().call();
        const cases = [];
        for (let i = 0; i < caseIds.length; i++) {
            try {
                const caseData = await caseContract.methods.getCase(caseIds[i]).call();
                if (caseData.exists) {
                    if (req.user.role === 'StationAdmin') {
                        if (userStationMap[caseData.createdBy] !== stationId) continue;
                    } else if (req.user.role === 'Officer') {
                        if (caseData.createdBy !== req.user.username) continue;
                    } else if (req.user.role === 'Prosecutor') {
                        if (caseData.prosecutorId !== req.user.username) continue;
                    } else if (req.user.role === 'Analyst') {
                        if (caseData.analystId !== req.user.username) continue;
                    }
                    cases.push({
                        id: caseIds[i],
                        number: caseData.caseNumber,
                        title: caseData.title,
                        crimeId: caseData.crimeId,
                        createdBy: caseData.createdBy,
                        isClosed: caseData.isClosed,
                        timestamp: Number(caseData.timestamp)
                    });
                }
            } catch (e) {
                console.warn(`⚠️ Error processing case ${caseIds[i]}:`, e.message);
            }
        }
        
        // Get all crimes
        const crimeIds = await crimeContract.methods.getAllCrimeIds().call();
        const crimes = [];
        for (let i = 0; i < crimeIds.length; i++) {
            try {
                const crime = await crimeContract.methods.getCrime(crimeIds[i]).call();
                if (crime.exists) {
                    crimes.push({
                        id: crimeIds[i],
                        name: crime.name,
                        createdBy: crime.createdBy,
                        timestamp: Number(crime.timestamp)
                    });
                }
            } catch (e) {
                console.warn(`⚠️ Error processing crime ${crimeIds[i]}:`, e.message);
            }
        }
        
        console.log(`📊 Cases: ${cases.length}, Crimes: ${crimes.length}`);
        
        // Calculate analytics
        const now = new Date();
        
        // Evidence by month (last 6 months)
        const evidenceByMonth = [];
        for (let i = 5; i >= 0; i--) {
            const month = new Date(now);
            month.setMonth(now.getMonth() - i);
            const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
            const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);
            
            const count = evidenceList.filter(e => {
                const date = new Date(e.timestamp * 1000);
                return date >= monthStart && date <= monthEnd;
            }).length;
            
            evidenceByMonth.push({
                month: month.toLocaleString('default', { month: 'short' }),
                year: month.getFullYear(),
                count
            });
        }
        
        // Evidence by file type
        const fileTypeCount = {};
        evidenceList.forEach(e => {
            const type = e.fileType.split('/')[0] || 'unknown';
            fileTypeCount[type] = (fileTypeCount[type] || 0) + 1;
        });
        const evidenceByFileType = Object.keys(fileTypeCount).map(key => ({
            type: key,
            count: fileTypeCount[key]
        }));
        
        // Evidence by status
        const courtReady = evidenceList.filter(e => e.isCourtReady).length;
        const weak = evidenceList.filter(e => e.isWeak).length;
        const pending = evidenceList.filter(e => !e.isCourtReady && !e.isWeak).length;
        const archived = evidenceList.filter(e => e.isArchived).length;
        
        // Uploads by user (top 10)
        const uploaderCount = {};
        evidenceList.forEach(e => {
            uploaderCount[e.uploader] = (uploaderCount[e.uploader] || 0) + 1;
        });
        const uploadsByUser = Object.keys(uploaderCount)
            .map(key => ({ user: key, count: uploaderCount[key] }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
        
        // Evidence by case
        const caseEvidenceCount = {};
        evidenceList.forEach(e => {
            if (e.caseId) {
                caseEvidenceCount[e.caseId] = (caseEvidenceCount[e.caseId] || 0) + 1;
            }
        });
        const evidenceByCase = Object.keys(caseEvidenceCount)
            .map(key => {
                const caseData = cases.find(c => c.id === key);
                return {
                    caseId: key,
                    caseNumber: caseData?.number || 'Unknown',
                    count: caseEvidenceCount[key]
                };
            })
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
        
        // Recent activity (last 20 events)
        const allHistory = [];
        for (let i = 0; i < Math.min(evidenceIds.length, 50); i++) {
            try {
                const history = await evidenceContract.methods.getHistory(evidenceIds[i]).call();
                const evidence = evidenceList.find(e => e.id === evidenceIds[i]);
                if (history && history.length > 0) {
                    history.forEach(log => {
                        allHistory.push({
                            evidenceId: evidenceIds[i],
                            fileName: evidence?.name || 'Unknown',
                            action: log.action,
                            notes: log.notes,
                            actorId: log.actorId,
                            timestamp: new Date(Number(log.timestamp) * 1000).toISOString()
                        });
                    });
                }
            } catch (e) {
                // Skip errors
            }
        }
        allHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        const recentActivity = allHistory.slice(0, 20);
        
        // Evidence size distribution
        const sizeRanges = {
            '0-1MB': 0,
            '1-5MB': 0,
            '5-10MB': 0,
            '10-25MB': 0,
            '25-50MB': 0,
            '50MB+': 0
        };
        evidenceList.forEach(e => {
            const sizeMB = e.size / (1024 * 1024);
            if (sizeMB < 1) sizeRanges['0-1MB']++;
            else if (sizeMB < 5) sizeRanges['1-5MB']++;
            else if (sizeMB < 10) sizeRanges['5-10MB']++;
            else if (sizeMB < 25) sizeRanges['10-25MB']++;
            else if (sizeMB < 50) sizeRanges['25-50MB']++;
            else sizeRanges['50MB+']++;
        });
        const sizeDistribution = Object.keys(sizeRanges).map(key => ({
            range: key,
            count: sizeRanges[key]
        }));
        
        // Cases by crime type
        const crimeCaseCount = {};
        cases.forEach(c => {
            if (c.crimeId) {
                crimeCaseCount[c.crimeId] = (crimeCaseCount[c.crimeId] || 0) + 1;
            }
        });
        const casesByCrime = Object.keys(crimeCaseCount)
            .map(key => {
                const crime = crimes.find(c => c.id === key);
                return {
                    crimeId: key,
                    crimeName: crime?.name || 'Unknown',
                    count: crimeCaseCount[key]
                };
            })
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
        
        // Case status
        const activeCases = cases.filter(c => !c.isClosed).length;
        const closedCases = cases.filter(c => c.isClosed).length;
        
        const responseData = {
            totals: {
                totalEvidence: evidenceList.length,
                totalCases: cases.length,
                totalCrimes: crimes.length,
                totalUsers: allUsers.length
            },
            evidenceByMonth,
            evidenceByFileType,
            evidenceByStatus: {
                courtReady,
                weak,
                pending,
                archived
            },
            uploadsByUser,
            evidenceByCase,
            recentActivity,
            sizeDistribution,
            casesByCrime,
            caseStatus: {
                active: activeCases,
                closed: closedCases
            }
        };
        
        console.log('📊 Analytics data sent successfully');
        res.json(responseData);
    } catch (error) {
        console.error('❌ Analytics Error:', error);
        res.status(500).json({ 
            error: 'Failed to fetch analytics data',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
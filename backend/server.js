require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const diseaseRoutes = require('./routes/diseaseRoutes');


const app = express();

app.use(cors());
app.use(express.json());
// ensure database has expected tables
require('./db');

app.use('/api/auth', authRoutes);
app.use('/api/diseases', diseaseRoutes);

app.get('/', (req, res) => {
    res.send('Welcome to the Health Adviser API');
});
app.use('/uploads', express.static('uploads'));


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});


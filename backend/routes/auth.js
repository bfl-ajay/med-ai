const multer = require('multer');
const path = require('path');
const fs = require('fs');
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');
const authMiddleware = require('../middleware/authMiddleware');
const pdf = require('pdf-parse');
const Tesseract = require('tesseract.js');
const router = express.Router();

const cron = require("node-cron");

console.log("AUTH ROUTES LOADED");

// Ensure upload folder exists
const uploadDir = path.join(__dirname, '../uploads/reports');

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer config
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + file.originalname;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// Prescription folder
const prescriptionDir = path.join(__dirname, '../uploads/prescriptions');

if (!fs.existsSync(prescriptionDir)) {
    fs.mkdirSync(prescriptionDir, { recursive: true });
}

// Prescription storage
const prescriptionStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, prescriptionDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + file.originalname;
        cb(null, uniqueName);
    }
});

const uploadPrescription = multer({
    storage: prescriptionStorage,
    limits: { fileSize: 5 * 1024 * 1024 }
});


router.post('/register', async (req, res) => {

    console.log("REGISTER ROUTE HIT");

    const {
        name,
        email,
        password,
        dob,
        gender,
        height,
        weight,
        bloodGroup,
        knownDiseases,
        mobile_no
    } = req.body;

    try {

        const hashedPassword = await bcrypt.hash(password, 10);

        const sql = `
            INSERT INTO users 
            (name, email, password, dob, height, weight, bloodGroup, known_diseases, mobile_no, gender) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const knownDiseasesJson = Array.isArray(knownDiseases)
            ? JSON.stringify(knownDiseases)
            : null;

        const [result] = await db.execute(
            sql,
            [
                name,
                email,
                hashedPassword,
                dob || null,
                height || null,
                weight || null,
                bloodGroup || null,
                knownDiseasesJson,
                mobile_no || null,
                gender || null
            ]
        );

        console.log("DB EXECUTED SUCCESSFULLY");

        return res.status(201).json({
            message: "User registered successfully"
        });

    } catch (err) {

        console.error("DB ERROR:", err);

        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ message: 'User already exists' });
        }

        return res.status(500).json({ message: 'Database error' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const [results] = await db.execute(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );

        if (results.length === 0) {
            return res.status(400).json({ message: 'Invalid email or password' });
        }

        const user = results[0];

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid email or password' });
        }

        const token = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        return res.json({ token });

    } catch (err) {
        console.error("LOGIN ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
});

router.get('/profile', authMiddleware, async (req, res) => {
    try {
        const sql = `
            SELECT 
                name,
                email,
                dob,
                height,
                weight,
                bloodGroup,
                known_diseases
            FROM users
            WHERE id = ?
        `;

        const [rows] = await db.execute(sql, [req.user.id]);

        if (rows.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        const user = rows[0]; // ✅ THIS is the actual user

        // ✅ Age calculation
        let age = null;

        if (user.dob) {
            const birthDate = new Date(user.dob);
            const today = new Date();

            age = today.getFullYear() - birthDate.getFullYear();

            const monthDifference = today.getMonth() - birthDate.getMonth();

            if (
                monthDifference < 0 ||
                (monthDifference === 0 && today.getDate() < birthDate.getDate())
            ) {
                age--;
            }
        }

        // ✅ BMI calculation
        let bmi = null;

        if (user.height && user.weight) {
            const heightInMeters = user.height / 100;
            bmi = user.weight / (heightInMeters * heightInMeters);
            bmi = parseFloat(bmi.toFixed(2));
        }

        // ✅ Lifestyle
        let lifestyle = "Complete profile to calculate BMI";

        if (bmi !== null) {
            if (bmi < 18.5)
                lifestyle = "Underweight - Consider a balanced diet.";
            else if (bmi < 25)
                lifestyle = "Normal weight - Maintain a healthy lifestyle.";
            else if (bmi < 30)
                lifestyle = "Overweight - Exercise recommended.";
            else
                lifestyle = "Obese - Consult a doctor.";
        }

        // ✅ Parse diseases
        let diseases = [];

        if (user.known_diseases) {
            try {
                diseases = JSON.parse(user.known_diseases);
            } catch (err) {
                diseases = [];
            }
        }

        // ✅ Health score
        let healthScore = 100;

        if (bmi > 25) healthScore -= 15;
        if (bmi < 18.5) healthScore -= 10;
        if (diseases.length > 0) healthScore -= 20;

        if (healthScore < 0) healthScore = 0;

        res.json({
            name: user.name,
            age,
            bmi,
            height: user.height,
            weight: user.weight,
            lifestyle,
            bloodGroup: user.bloodGroup,
            knownDiseases: diseases,
            healthScore,
            email: user.email
        });

    } catch (err) {
        console.error("PROFILE ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
});

router.put('/profile', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;

        const {
            name,
            email,
            height,
            weight,
            bloodGroup,
            knownDiseases
        } = req.body;

        const sql = `
            UPDATE users
            SET name = ?, 
                email = ?, 
                height = ?, 
                weight = ?, 
                bloodGroup = ?, 
                known_diseases = ?
            WHERE id = ?
        `;

        await db.execute(sql, [
            name,
            email,
            height || null,
            weight || null,
            bloodGroup || null,
            JSON.stringify(knownDiseases || []),
            userId
        ]);

        res.json({ message: "Profile updated successfully" });

    } catch (err) {
        console.error("UPDATE PROFILE ERROR:", err);
        res.status(500).json({ message: "Database error" });
    }
});
const axios = require('axios');

router.post('/ai-plan', authMiddleware, async (req, res) => {
    try {
        const bmi = req.body.bmi;
        const diseases = req.body.knownDiseases || [];

        let targetCalories = 2000;

        if (bmi < 18.5) targetCalories = 2400;
        else if (bmi < 25) targetCalories = 2200;
        else if (bmi < 30) targetCalories = 1800;
        else targetCalories = 1600;

        let diet = "Balanced Diet";

        if (diseases.some(d => d.toLowerCase().includes("diabetes")))
            diet = "Low Sugar Diet";

        if (diseases.some(d => d.toLowerCase().includes("heart")))
            diet = "Heart Healthy Diet";

        // SIMPLE SMART MEAL LOGIC


        const mealPlan = [
            {
                title: "Oats with Fruits",
                readyInMinutes: 10,
                sourceUrl: "#"
            },
            {
                title: "Boiled Eggs & Green Salad",
                readyInMinutes: 15,
                sourceUrl: "#"
            },
            {
                title: "Grilled Vegetables & Brown Rice",
                readyInMinutes: 25,
                sourceUrl: "#"
            }
        ];

        //  SMART WORKOUT LOGIC

        let workoutPlan = [];

        if (bmi < 18.5) {
            workoutPlan = [
                { name: "Light Jogging", description: "15 minutes daily" },
                { name: "Push Ups", description: "3 sets of 10 reps" },
                { name: "Squats", description: "3 sets of 15 reps" }
            ];
        }
        else if (bmi < 25) {
            workoutPlan = [
                { name: "Brisk Walking", description: "30 minutes daily" },
                { name: "Plank", description: "3 sets of 30 seconds" },
                { name: "Cycling", description: "20 minutes moderate pace" }
            ];
        }
        else if (bmi < 30) {
            workoutPlan = [
                { name: "Fast Walking", description: "40 minutes daily" },
                { name: "Jump Rope", description: "3 sets of 2 minutes" },
                { name: "Bodyweight Squats", description: "4 sets of 15 reps" }
            ];
        }
        else {
            workoutPlan = [
                { name: "Slow Walking", description: "20 minutes daily" },
                { name: "Chair Squats", description: "3 sets of 10 reps" },
                { name: "Stretching Routine", description: "15 minutes flexibility work" }
            ];
        }

        // AVOID FOODS LOGIC

        let avoidFoods = [];

        if (diseases.some(d => d.toLowerCase().includes("diabetes"))) {
            avoidFoods.push("White Sugar", "Sweets", "Soft Drinks");
        }

        if (diseases.some(d => d.toLowerCase().includes("hypertension"))) {
            avoidFoods.push("High Salt Foods", "Pickles", "Processed Snacks");
        }

        if (diseases.some(d => d.toLowerCase().includes("heart"))) {
            avoidFoods.push("Fried Food", "Red Meat", "Butter");
        }

        avoidFoods = [...new Set(avoidFoods)];

        res.json({
            mealPlan,
            workoutPlan,
            healthInsights: [
                `Calorie Target: ${targetCalories}`,
                `Recommended Diet: ${diet}`
            ],
            avoidFoods
        });

    } catch (err) {
        console.error("AI PLAN ERROR:", err);
        res.status(500).json({ message: "Error generating plan" });
    }
});

router.post('/medicine', authMiddleware, (req, res) => {
    try {
        const { medicineName, time } = req.body;

        if (!medicineName || !time) {
            return res.status(400).json({ message: "Missing fields" });
        }

        // time format from frontend = "HH:MM"
        const [hourStr, minuteStr] = time.split(":");

        const hour = parseInt(hourStr);
        const minute = parseInt(minuteStr);

        // Convert to cron format
        const cronTime = `${minute} ${hour} * * *`;

        cron.schedule(cronTime, () => {
            console.log(`Reminder: Take ${medicineName}`);
        });

        console.log("Cron Scheduled:", cronTime);

        res.json({ message: "Reminder set successfully" });

    } catch (err) {
        console.error("REMINDER ERROR:", err);
        res.status(500).json({ message: "Reminder error" });
    }
});

router.post('/reminders', authMiddleware, async (req, res) => {
    try {
        const { medicineName, time } = req.body;
        const userId = req.user.id;

        if (!medicineName || !time) {
            return res.status(400).json({ message: "Missing fields" });
        }

        const sql = `
            INSERT INTO reminders (user_id, medicine_name, time)
            VALUES (?, ?, ?)
        `;

        const [result] = await db.execute(sql, [userId, medicineName, time]);

        res.json({
            id: result.insertId,
            name: medicineName,
            time
        });

    } catch (err) {
        console.error("REMINDER INSERT ERROR:", err);
        return res.status(500).json({ message: "Database error" });
    }
});

router.get('/reminders', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;

        const sql = `
            SELECT id, medicine_name, time 
            FROM reminders 
            WHERE user_id = ?
        `;

        const [rows] = await db.execute(sql, [userId]);

        const reminders = rows.map(r => ({
            id: r.id,
            name: r.medicine_name,
            time: r.time
        }));

        res.json(reminders);

    } catch (err) {
        console.error("REMINDERS FETCH ERROR:", err);
        return res.status(500).json({ message: "Database error" });
    }
});

router.put('/reminders/:id', authMiddleware, async (req, res) => {
    try {
        const reminderId = req.params.id;
        const userId = req.user.id;
        const { name, time } = req.body;

        const sql = `
            UPDATE reminders 
            SET medicine_name = ?, time = ?
            WHERE id = ? AND user_id = ?
        `;

        const [result] = await db.execute(sql, [name, time, reminderId, userId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Reminder not found or access denied" });
        }

        res.json({ message: "Updated successfully" });

    } catch (err) {
        console.error("REMINDER UPDATE ERROR:", err);
        return res.status(500).json({ message: "Database error" });
    }
});

router.delete('/reminders/:id', authMiddleware, async (req, res) => {
    try {
        const reminderId = req.params.id;
        const userId = req.user.id;

        const sql = `DELETE FROM reminders WHERE id = ? AND user_id = ?`;

        const [result] = await db.execute(sql, [reminderId, userId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Reminder not found or access denied" });
        }

        res.json({ message: "Deleted successfully" });
    } catch (err) {
        console.error("REMINDER DELETE ERROR:", err);
        return res.status(500).json({ message: "Database error" });
    }
});

router.post(
    '/upload-report',
    authMiddleware,
    upload.single('report'),
    async (req, res) => {
        try {
            const userId = req.user.id;

            if (!req.file) {
                return res.status(400).json({ message: "No file uploaded" });
            }

            const sql = `
                INSERT INTO medical_reports (user_id, file_name, file_path)
                VALUES (?, ?, ?)
            `;

            await db.execute(sql, [
                userId,
                req.file.originalname,
                req.file.filename
            ]);

            res.json({ message: "Report uploaded successfully" });

        } catch (err) {
            console.error("UPLOAD ERROR:", err);
            res.status(500).json({ message: "Upload failed" });
        }
    }
);

router.get('/reports', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;

        const sql = `
            SELECT id, file_name, file_path, uploaded_at
            FROM medical_reports
            WHERE user_id = ?
            ORDER BY uploaded_at DESC
        `;

        const [rows] = await db.execute(sql, [userId]);

        res.json(rows);

    } catch (err) {
        console.error("GET REPORTS ERROR:", err);
        res.status(500).json({ message: "Database error" });
    }
});

router.delete('/report/:id', authMiddleware, async (req, res) => {
    try {
        const reportId = req.params.id;
        const userId = req.user.id;

        const sql = `
            DELETE FROM medical_reports
            WHERE id = ? AND user_id = ?
        `;

        await db.execute(sql, [reportId, userId]);

        res.json({ message: "Deleted successfully" });

    } catch (err) {
        console.error("DELETE REPORT ERROR:", err);
        res.status(500).json({ message: "Delete failed" });
    }
});

router.post(
    '/upload-prescription',
    authMiddleware,
    uploadPrescription.single('prescription'),
    async (req, res) => {
        try {
            const userId = req.user.id;
            const doctorName = req.body.doctorName || null;
            const notes = req.body.notes || null;

            if (!req.file) {
                return res.status(400).json({ message: "No file uploaded" });
            }

            const sql = `
                INSERT INTO prescriptions
                (user_id, file_name, file_path, doctor_name, notes)
                VALUES (?, ?, ?, ?, ?)
            `;

            await db.execute(sql, [
                userId,
                req.file.originalname,
                req.file.filename,
                doctorName,
                notes
            ]);

            res.json({ message: "Prescription uploaded successfully" });

        } catch (err) {
            console.error("UPLOAD PRESCRIPTION ERROR:", err);
            res.status(500).json({ message: "Database error" });
        }
    }
);
router.get('/prescriptions', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;

        const sql = `
            SELECT id, file_name, file_path, doctor_name, notes, uploaded_at
            FROM prescriptions
            WHERE user_id = ?
            ORDER BY uploaded_at DESC
        `;

        const [rows] = await db.execute(sql, [userId]);

        res.json(rows);

    } catch (err) {
        console.error("GET PRESCRIPTIONS ERROR:", err);
        res.status(500).json({ message: "Database error" });
    }
});

router.post('/save-manual-prescription', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const doctorName = req.body.doctorName || null;
        const manualText = req.body.manualText || null;

        if (!manualText) {
            return res.status(400).json({ message: "Prescription text required" });
        }

        const sql = `
            INSERT INTO prescriptions
            (user_id, doctor_name, manual_text)
            VALUES (?, ?, ?)
        `;

        await db.execute(sql, [userId, doctorName, manualText]);

        res.json({ message: "Manual prescription saved" });

    } catch (err) {
        console.error("MANUAL PRESCRIPTION ERROR:", err);
        res.status(500).json({ message: "Database error" });
    }
});

router.get('/get-add-info', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;

        const sql = `
            SELECT *
            FROM user_additional_info
            WHERE user_id = ?
            ORDER BY created_at DESC
        `;

        const [rows] = await db.execute(sql, [userId]);

        res.json(rows);

    } catch (err) {
        console.error("GET ADD INFO ERROR:", err);
        res.status(500).json({ message: "Database error" });
    }
});

router.get('/get-latest-add-info', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;

        const sql = `
            SELECT *
            FROM user_additional_info
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT 1
        `;

        const [rows] = await db.execute(sql, [userId]);

        res.json(rows[0] || null);

    } catch (err) {
        console.error("GET LATEST ADD INFO ERROR:", err);
        res.status(500).json({ message: "Database error" });
    }
});

router.get('/analyze-report/:id', authMiddleware, async (req, res) => {
    try {
        const reportId = req.params.id;
        const userId = req.user.id;

        const sql = `
            SELECT file_path
            FROM medical_reports
            WHERE id = ? AND user_id = ?
        `;

        const [rows] = await db.execute(sql, [reportId, userId]);

        if (rows.length === 0) {
            return res.status(404).json({ message: "Report not found" });
        }

        const filePath = path.join(
            __dirname,
            '../uploads/reports/',
            rows[0].file_path
        );

        let extractedText = "";

        if (filePath.endsWith('.pdf')) {
            const dataBuffer = fs.readFileSync(filePath);
            const pdfData = await pdf(dataBuffer);
            extractedText = pdfData.text;
        } else {
            const result = await Tesseract.recognize(filePath, 'eng');
            extractedText = result.data.text;
        }

        const suggestions = generateSuggestions(extractedText);

        res.json({
            extractedText,
            suggestions
        });

    } catch (error) {
        console.error("ANALYZE REPORT ERROR:", error);
        res.status(500).json({ message: "Failed to analyze report" });
    }
});
router.get("/analyze-prescription/:id", authMiddleware, async (req, res) => {
    try {
        const prescriptionId = req.params.id;
        const userId = req.user.id;

        const [rows] = await db.execute(
            "SELECT * FROM prescriptions WHERE id = ? AND user_id = ?",
            [prescriptionId, userId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: "Prescription not found" });
        }

        const filePath = path.join(
            __dirname,
            "../uploads/prescriptions",
            rows[0].file_path
        );

        const result = await Tesseract.recognize(filePath, "eng");
        const extractedText = result.data.text;

        if (!extractedText) {
            return res.json({
                message: "No readable text found in image."
            });
        }

        const lines = extractedText.split("\n");
        const parsedMedicines = [];

        let currentMedicine = null;
        let currentDosage = null;
        let currentTimes = [];

        function convertFrequency(text) {
            const lower = text.toLowerCase();
            if (lower.includes("three")) return ["08:00", "13:00", "20:00"];
            if (lower.includes("twice")) return ["08:00", "20:00"];
            if (lower.includes("once")) return ["08:00"];
            if (lower.includes("as needed")) return ["PRN"];
            return ["08:00"];
        }

        for (let line of lines) {
            line = line.trim();
            if (!line) continue;

            const medMatch = line.match(/^\d+\.\s*(.+)/);
            if (medMatch) {
                currentMedicine = medMatch[1].trim();
                continue;
            }

            if (line.toLowerCase().includes("dosage")) {
                const dosageMatch = line.match(
                    /(\d+\s?(mg|ml|units|iu|puffs?|tablets?|capsules?|drops?))/i
                );
                if (dosageMatch) {
                    currentDosage = dosageMatch[0];
                }
                continue;
            }

            if (line.toLowerCase().includes("frequency")) {
                currentTimes = convertFrequency(line);

                if (currentMedicine && currentDosage) {
                    parsedMedicines.push({
                        name: currentMedicine,
                        dosage: currentDosage,
                        times: currentTimes
                    });
                }

                currentMedicine = null;
                currentDosage = null;
                currentTimes = [];
            }
        }

        res.json({
            extractedText,
            medicines: parsedMedicines
        });

    } catch (error) {
        console.error("OCR ERROR:", error);
        res.status(500).json({ message: "Server error during OCR" });
    }
});

router.post('/blood_pressure_records', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { systolic, diastolic, pulse } = req.body;

        if (!systolic || !diastolic) {
            return res.status(400).json({ message: "Missing BP values" });
        }

        const sql = `
            INSERT INTO blood_pressure_records
            (user_id, systolic, diastolic, pulse)
            VALUES (?, ?, ?, ?)
        `;

        await db.execute(sql, [
            userId,
            systolic,
            diastolic,
            pulse || null
        ]);

        res.json({ message: "Blood pressure recorded successfully" });

    } catch (err) {
        console.error("BP INSERT ERROR:", err);
        res.status(500).json({ message: "Database error" });
    }
});

router.get('/blood_pressure_records', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;

        const sql = `
            SELECT id, systolic, diastolic, pulse, recorded_at
            FROM blood_pressure_records
            WHERE user_id = ?
            ORDER BY recorded_at DESC
        `;

        const [rows] = await db.execute(sql, [userId]);

        res.json(rows);

    } catch (err) {
        console.error("BP FETCH ERROR:", err);
        res.status(500).json({ message: "Database error" });
    }
});
router.post("/add-reminder-from-prescription", authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, dosage, time } = req.body;

        if (!name || !dosage || !time) {
            return res.status(400).json({ message: "Missing fields" });
        }

        const normalizedName = name.trim().toLowerCase();
        const normalizedDosage = dosage.trim().toLowerCase();

        // Prevent duplicates
        const [existing] = await db.promise().query(
            `SELECT id FROM reminders 
       WHERE user_id = ? 
       AND LOWER(TRIM(medicine_name)) = ? 
       AND LOWER(TRIM(dosage)) = ? 
       AND time = ?`,
            [userId, normalizedName, normalizedDosage, time]
        );

        if (existing.length > 0) {
            return res.json({ message: "Reminder already exists" });
        }

        await db.promise().query(
            "INSERT INTO reminders (user_id, medicine_name, dosage, time) VALUES (?, ?, ?, ?)",
            [userId, normalizedName, normalizedDosage, time]
        );

        res.json({ message: "Reminder added successfully" });

    } catch (error) {
        console.error("ADD REMINDER ERROR:", error);
        res.status(500).json({ message: "Server error" });
    }
});

function detectMedicalTerms(text) {
    const lower = text.toLowerCase();

    const medLookup = [
        "asthma",
        "diabetes",
        "hypertension",
        "cholesterol",
        "heart",
        "flu",
        "covid",
        "bronchitis",
        "pneumonia"
    ];

    return medLookup.filter(term => lower.includes(term));
}

router.delete('/prescriptions/:id', authMiddleware, async (req, res) => {
    try {
        const id = req.params.id;
        const userId = req.user.id;

        const sql = `
            DELETE FROM prescriptions
            WHERE id = ? AND user_id = ?
        `;

        const [result] = await db.execute(sql, [id, userId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Prescription not found" });
        }

        res.json({ message: "Deleted successfully" });

    } catch (err) {
        console.error("DELETE PRESCRIPTION ERROR:", err);
        res.status(500).json({ message: "Delete failed" });
    }
});

router.post('/contact', async (req, res) => {
    try {
        const { name, email, message } = req.body;

        if (!name || !email || !message) {
            return res.status(400).json({ message: "All fields are required" });
        }

        const sql = `
            INSERT INTO contact_messages (name, email, message)
            VALUES (?, ?, ?)
        `;

        await db.execute(sql, [name, email, message]);

        res.json({ message: "Message sent successfully" });

    } catch (err) {
        console.error("CONTACT ERROR:", err);
        res.status(500).json({ message: "Database error" });
    }
});
function generateSuggestions(text) {

    if (!text) {
        return {
            diagnosis: "Not detected",
            severity: "Low",
            advice: "No readable medical information found."
        };
    }

    const lowerText = text.toLowerCase();

    // Example rules
    if (lowerText.includes("asthma")) {
        return {
            diagnosis: "Asthma",
            severity: "Moderate",
            advice: "Avoid dust exposure, carry inhaler at all times, and follow up with your physician regularly."
        };
    }

    if (lowerText.includes("diabetes")) {
        return {
            diagnosis: "Diabetes",
            severity: "High",
            advice: "Monitor blood sugar daily, avoid high sugar foods, and maintain regular exercise."
        };
    }

    if (lowerText.includes("hypertension") || lowerText.includes("high blood pressure")) {
        return {
            diagnosis: "Hypertension",
            severity: "Moderate",
            advice: "Reduce salt intake, manage stress, and monitor blood pressure regularly."
        };
    }

    // Default fallback
    return {
        diagnosis: "General Condition",
        severity: "Low",
        advice: "Please consult your doctor for proper interpretation of this report."
    };
}

module.exports = router;
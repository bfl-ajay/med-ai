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
        const sql = `INSERT INTO users (name, email, password, dob,height , weight, bloodGroup, known_diseases, mobile_no, gender) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const knownDiseasesJson = Array.isArray(knownDiseases) ? JSON.stringify(knownDiseases) : null;
        console.log("DOB RECEIVED:", dob);
        db.query(sql, [name, email, hashedPassword, dob || null, height || null, weight || null, bloodGroup || null, knownDiseasesJson, mobile_no || null, gender || null], (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(400).json({ message: 'User already exists' });
                }
                console.error('DB error on register:', err);
                return res.status(500).json({ message: 'Database error' });
            }
            res.status(201).json({ message: 'User registered successfully' });
        });
    } catch (err) {
        console.error('Server error on register:', err);
        res.status(500).json({ message: 'Server error' });
    }

});

router.post('/login', (req, res) => {
    const { email, password } = req.body;
    const sql = 'SELECT * FROM users WHERE email = ?';

    db.query(sql, [email], async (err, results) => {
        if (err) {
            return res.status(400).json({ message: 'Invalid email or password' });
        }
        if (!results || results.length === 0) {
            return res.status(400).json({ message: 'Invalid email or password' });
        }
        const user = results[0];
        try {
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(400).json({ message: 'Invalid email or password' });
            }
            const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
            res.json({ token });
        } catch (compareErr) {
            console.error('Error comparing passwords:', compareErr);
            return res.status(500).json({ message: 'Server error' });
        }
    });

});

router.get('/profile', authMiddleware, (req, res) => {

    const sql = `
SELECT 
    name,
    dob,
    height,
    weight,
    bloodGroup,
    known_diseases
FROM users
WHERE id = ?
`;

    db.query(sql, [req.user.id], (err, results) => {
        if (err || results.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = results[0];
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
        // BMI calculation
        const heightInMeters = user.height / 100;
        const bmi = user.weight / (heightInMeters * heightInMeters);

        // Lifestyle
        let lifestyle = "";
        if (bmi < 18.5) lifestyle = "Underweight - Consider a balanced diet.";
        else if (bmi < 25) lifestyle = "Normal weight - Maintain a healthy lifestyle.";
        else if (bmi < 30) lifestyle = "Overweight - Exercise recommended.";
        else lifestyle = "Obese - Consult a doctor.";

        //  Proper JSON parsing (THIS is the important part)
        let diseases = [];

        if (user.known_diseases) {
            try {
                if (typeof user.known_diseases === "string") {

                    let cleaned = user.known_diseases.trim();

                    if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
                        cleaned = cleaned.slice(1, -1);
                    }

                    diseases = JSON.parse(cleaned);
                } else {
                    diseases = user.known_diseases;
                }
            } catch (err) {
                console.log("Parsing error:", err);
                diseases = [];
            }
        }
        let healthScore = 100;


        if (bmi > 25) healthScore -= 15;
        if (bmi < 18.5) healthScore -= 10;
        if (diseases.length > 0) healthScore -= 20;

        if (healthScore < 0) healthScore = 0;

        res.json({
            name: user.name,
            age,
            bmi,
            lifestyle,
            bloodGroup: user.bloodGroup,
            knownDiseases: diseases,
            healthScore,
        });
    });
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

router.post('/reminders', authMiddleware, (req, res) => {
    const { medicineName, time } = req.body;
    const userId = req.user.id;

    if (!medicineName || !time) {
        return res.status(400).json({ message: "Missing fields" });
    }

    const sql = `
        INSERT INTO reminders (user_id, medicine_name, time)
        VALUES (?, ?, ?)
    `;

    db.query(sql, [userId, medicineName, time], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: "Database error" });
        }

        res.json({
            id: result.insertId,
            name: medicineName,
            time
        });
    });
});

router.get('/reminders', authMiddleware, (req, res) => {
    const userId = req.user.id;

    const sql = `SELECT id, medicine_name, time FROM reminders WHERE user_id = ?`;

    db.query(sql, [userId], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: "Database error" });
        }

        const reminders = results.map(r => ({
            id: r.id,
            name: r.medicine_name,
            time: r.time
        }));

        res.json(reminders);
    });
});

router.put('/reminders/:id', authMiddleware, (req, res) => {
    const reminderId = req.params.id;
    const userId = req.user.id;
    const { name, time } = req.body;

    const sql = `
        UPDATE reminders 
        SET medicine_name = ?, time = ?
        WHERE id = ? AND user_id = ?
    `;

    db.query(sql, [name, time, reminderId, userId], (err) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: "Update failed" });
        }

        res.json({ message: "Updated successfully" });
    });
});

router.delete('/reminders/:id', authMiddleware, (req, res) => {
    const reminderId = req.params.id;
    const userId = req.user.id;

    const sql = `DELETE FROM reminders WHERE id = ? AND user_id = ?`;

    db.query(sql, [reminderId, userId], (err) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: "Delete failed" });
        }

        res.json({ message: "Deleted successfully" });
    });
});

router.post('/upload-report', authMiddleware, upload.single('report'), (req, res) => {
    try {
        const userId = req.user.id;

        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }

        const sql = `
            INSERT INTO medical_reports (user_id, file_name, file_path)
            VALUES (?, ?, ?)
        `;

        db.query(sql, [userId, req.file.originalname, req.file.filename], (err) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ message: "Database error" });
            }

            res.json({ message: "Report uploaded successfully" });
        });

    } catch (err) {
        console.error("UPLOAD ERROR:", err);
        res.status(500).json({ message: "Upload failed" });
    }
});
router.get('/reports', authMiddleware, (req, res) => {
    const userId = req.user.id;

    const sql = `
        SELECT id, file_name, file_path, uploaded_at
        FROM medical_reports
        WHERE user_id = ?
        ORDER BY uploaded_at DESC
    `;

    db.query(sql, [userId], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: "Database error" });
        }

        res.json(results);
    });
});
router.delete('/report/:id', authMiddleware, (req, res) => {

    const reportId = req.params.id;
    const userId = req.user.id;

    const sql = `DELETE FROM medical_reports WHERE id = ? AND user_id = ?`;

    db.query(sql, [reportId, userId], (err) => {
        if (err) return res.status(500).json({ message: "Delete failed" });
        res.json({ message: "Deleted successfully" });
    });
});

router.post(
    '/upload-prescription',
    authMiddleware,
    uploadPrescription.single('prescription'),
    (req, res) => {

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

        db.query(sql, [
            userId,
            req.file.originalname,
            req.file.filename,
            doctorName,
            notes
        ], (err) => {
            if (err) return res.status(500).json({ message: "Database error" });
            res.json({ message: "Prescription uploaded successfully" });
        });
    });

router.get('/prescriptions', authMiddleware, (req, res) => {
    const userId = req.user.id;

    const sql = `
      SELECT id, file_name, file_path, doctor_name, notes, uploaded_at
      FROM prescriptions
      WHERE user_id = ?
      ORDER BY uploaded_at DESC
    `;

    db.query(sql, [userId], (err, results) => {
        if (err) return res.status(500).json({ message: "Database error" });
        res.json(results);
    });
});
router.post('/save-manual-prescription', authMiddleware, (req, res) => {

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

    db.query(sql, [userId, doctorName, manualText], (err) => {
        if (err) return res.status(500).json({ message: "Database error" });
        res.json({ message: "Manual prescription saved" });
    });
});

router.post('/save-add-info', authMiddleware, (req, res) => {
    const { emergencyContact, allergies, notes } = req.body;
    const userId = req.user.id;

    const checkSql = `
    SELECT id FROM user_additional_info
    WHERE user_id = ?
  `;

    db.query(checkSql, [userId], (err, results) => {
        if (err) {
            console.error("CHECK ERROR:", err);
            return res.status(500).json({ message: "Database error" });
        }

        if (results.length > 0) {
            // UPDATE existing
            const updateSql = `
        UPDATE user_additional_info
        SET emergency_contact = ?, allergies = ?, medical_notes = ?
        WHERE user_id = ?
      `;

            db.query(updateSql,
                [emergencyContact, allergies, notes, userId],
                (err2) => {
                    if (err2) {
                        console.error("UPDATE ERROR:", err2);
                        return res.status(500).json({ message: "Update failed" });
                    }

                    res.json({ message: "Information updated successfully" });
                });

        } else {
            // INSERT new
            const insertSql = `
        INSERT INTO user_additional_info
        (user_id, emergency_contact, allergies, medical_notes)
        VALUES (?, ?, ?, ?)
      `;

            db.query(insertSql,
                [userId, emergencyContact, allergies, notes],
                (err3) => {
                    if (err3) {
                        console.error("INSERT ERROR:", err3);
                        return res.status(500).json({ message: "Insert failed" });
                    }

                    res.json({ message: "Information saved successfully" });
                });
        }
    });
});

router.get('/get-add-info', authMiddleware, (req, res) => {

    const userId = req.user.id;

    const sql = `
    SELECT * FROM user_additional_info
    WHERE user_id = ?
    ORDER BY created_at DESC
  `;

    db.query(sql, [userId], (err, results) => {

        if (err) {
            console.error("DB ERROR:", err);
            return res.status(500).json({ message: "Database error" });
        }

        res.json(results);
    });
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

        db.query(sql, [reportId, userId], async (err, results) => {

            if (err || results.length === 0) {
                return res.status(404).json({ message: "Report not found" });
            }

            const filePath = path.join(__dirname, '../uploads/reports/', results[0].file_path);

            let extractedText = "";

            // If PDF
            if (filePath.endsWith('.pdf')) {
                const dataBuffer = fs.readFileSync(filePath);
                const pdfData = await pdf(dataBuffer);
                extractedText = pdfData.text;
            }
            // If Image
            else {
                const result = await Tesseract.recognize(filePath, 'eng');
                extractedText = result.data.text;
            }

            // Simple AI logic
            const suggestions = generateSuggestions(extractedText);

            res.json({
                extractedText,
                suggestions
            });

        });

    } catch (error) {
        console.error("Analysis Error:", error);
        res.status(500).json({ message: "Failed to analyze report" });
    }
});

router.get("/analyze-prescription/:id", authMiddleware, async (req, res) => {
    try {
        const prescriptionId = req.params.id;
        const userId = req.user.id;

        const [rows] = await db.promise().query(
            "SELECT * FROM prescriptions WHERE id = ? AND user_id = ?",
            [prescriptionId, userId]
        );

        if (!rows || rows.length === 0) {
            return res.status(404).json({ message: "Prescription not found" });
        }

        const filePath = path.join(
            __dirname,
            "../uploads/prescriptions",
            rows[0].file_path
        );

        const result = await Tesseract.recognize(filePath, "eng");
        const extractedText = result.data.text;

        console.log("========== OCR OUTPUT ==========");
        console.log(extractedText);
        console.log("================================");

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

            if (lower.includes("as needed")) {
                return ["PRN"]; // PRN = medical term for "as needed"
            }

            return ["08:00"]; // fallback
        }

        for (let line of lines) {
            line = line.trim();
            if (!line) continue;

            // Match medicine name like "1. Ibuprofen"
            const medMatch = line.match(/^\d+\.\s*(.+)/);
            if (medMatch) {
                currentMedicine = medMatch[1].trim();
                continue;
            }

            // Match dosage line
            if (line.toLowerCase().includes("dosage")) {
                const dosageMatch = line.match(
                    /(\d+\s?(mg|ml|units|iu|puffs?|tablets?|capsules?|drops?))/i
                );
                if (dosageMatch) {
                    currentDosage = dosageMatch[0];
                }
                continue;
            }

            // Match frequency line
            if (line.toLowerCase().includes("frequency")) {
                currentTimes = convertFrequency(line);

                if (currentMedicine && currentDosage) {
                    parsedMedicines.push({
                        name: currentMedicine,
                        dosage: currentDosage,
                        times: currentTimes
                    });
                }

                // reset for next medicine
                currentMedicine = null;
                currentDosage = null;
                currentTimes = [];
            }
        }

        console.log("PARSED MEDICINES:", parsedMedicines);


        // Insert into reminders
        //     for (const med of parsedMedicines) {
        //         for (const time of med.times) {

        //             const normalizedName = med.name.trim().toLowerCase();
        //             const normalizedDosage = med.dosage.trim().toLowerCase();
        //             const normalizedTime = time.trim();

        //             const [existing] = await db.promise().query(
        //                 `SELECT id FROM reminders 
        //    WHERE user_id = ? 
        //    AND LOWER(TRIM(medicine_name)) = ? 
        //    AND LOWER(TRIM(dosage)) = ? 
        //    AND time = ?`,
        //                 [userId, normalizedName, normalizedDosage, normalizedTime]
        //             );

        //             if (existing.length === 0) {
        //                 await db.promise().query(
        //                     "INSERT INTO reminders (user_id, medicine_name, dosage, time) VALUES (?, ?, ?, ?)",
        //                     [userId, normalizedName, normalizedDosage, normalizedTime]
        //                 );
        //             }
        //         }
        //     }

        res.json({
            extractedText,
            medicines: parsedMedicines
        });

    } catch (error) {
        console.error("OCR ERROR:", error);
        res.status(500).json({ message: "Server error during OCR" });
    }
});

router.post('/blood_pressure_records', authMiddleware, (req, res) => {
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

    db.query(sql, [userId, systolic, diastolic, pulse || null], (err) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: "Database error" });
        }

        res.json({ message: "Blood pressure recorded successfully" });
    });
});
router.get('/blood_pressure_records', authMiddleware, (req, res) => {
    const userId = req.user.id;

    const sql = `
        SELECT id, systolic, diastolic, pulse, recorded_at
        FROM blood_pressure_records
        WHERE user_id = ?
        ORDER BY recorded_at DESC
    `;

    db.query(sql, [userId], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: "Database error" });
        }

        res.json(results);
    });
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

router.delete('/prescriptions/:id', authMiddleware, (req, res) => {
    const id = req.params.id;
    const userId = req.user.id;

    const sql = `
        DELETE FROM prescriptions 
        WHERE id = ? AND user_id = ?
    `;

    db.query(sql, [id, userId], (err, result) => {
        if (err) {
            console.error("DELETE ERROR:", err);
            return res.status(500).json({ message: "Delete failed" });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Prescription not found" });
        }

        res.json({ message: "Deleted successfully" });
    });
});

router.post('/contact', (req, res) => {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
        return res.status(400).json({ message: "All fields are required" });
    }

    const sql = `
        INSERT INTO contact_messages (name, email, message)
        VALUES (?, ?, ?)
    `;

    db.query(sql, [name, email, message], (err) => {
        if (err) {
            console.error("CONTACT INSERT ERROR:", err);
            return res.status(500).json({ message: "Database error" });
        }

        res.json({ message: "Message sent successfully" });
    });
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
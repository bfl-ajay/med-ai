import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/core/services/auth.service';
import { Chart } from 'chart.js/auto';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent implements OnInit {

  profile: any;
  aiPlan: any;
  additionalInfos: any[] = [];
  medicines: any[] = [];
  medicineName: string = '';
  medicineTime: string = '';
  bpRecords: any[] = [];
  bpDates: string[] = [];
  currentBP: any[] = [];
  previousBP: any[] = [];
  filteredBP: any[] = [];
  systolic: number[] = [];
  diastolic: number[] = [];
  pulse: number[] = [];
  prescriptions: any[] = [];
  analyzedPrescriptionId: number | null = null;
  selectedPrescriptionId: number | null = null;
  showAll: boolean = false;

  reminders: { id: number; name: string; time: string; editing: boolean }[] = [];

  constructor(private router: Router, private authService: AuthService) { }

  ngOnInit() {
    this.loadAdditionalInfo();
    this.loadBP();
    this.authService.getPrescriptions().subscribe((data: any) => {
      this.prescriptions = data;
    });
    this.authService.getProfile().subscribe({
      next: (res: any) => {
        this.profile = res;

        // Calculate health score AFTER profile loads
        this.profile.healthScore = this.calculateHealthScore();

        // Wait for DOM to render
        setTimeout(() => {
          this.createChart();
        }, 100);
      },
      error: (err) => {
        console.log(err);
      }

    });

    this.authService.getAdditionalInfo().subscribe({
      next: (res: any) => {
        this.additionalInfos = res;
      },
      error: (err) => {
        console.log("Additional info load error", err);
      }
    });

    // Load reminders
    this.authService.getReminders().subscribe((data: any) => {
      console.log("REMINDERS FROM DB:", data);
      this.reminders = data;
    });
  }

  loadAdditionalInfo() {
    this.authService.getAdditionalInfo().subscribe((res: any) => {
      this.additionalInfos = res || [];
    });
  }
  // HEALTH SCORE
  calculateHealthScore(): number {

    if (!this.profile) return 0;

    let score = 0;
    const bmi = this.profile.bmi;
    const diseases = this.profile.knownDiseases || [];

    if (bmi >= 18.5 && bmi < 25) {
      score = 90;
    } else if (bmi >= 25 && bmi < 30) {
      score = 70;
    } else if (bmi < 18.5) {
      score = 65;
    } else {
      score = 50;
    }

    score -= diseases.length * 10;

    if (score < 20) score = 20;

    return score;
  }

  // CHART
  createChart() {

    if (!this.profile?.bmi) return;

    const canvas = document.getElementById("bmiChart") as HTMLCanvasElement;

    if (!canvas) return;

    new Chart(canvas, {
      type: 'bar',
      data: {
        labels: ['Your BMI'],
        datasets: [{
          label: 'BMI',
          data: [this.profile.bmi]
        }]
      }
    });
  }

  // AI PLAN
  getPlan() {
    this.authService.getAIPlan(this.profile).subscribe({
      next: (res: any) => {
        console.log("PLAN:", res);
        this.aiPlan = res;
      },
      error: (err) => {
        console.error(err);
      }
    });
  }
  // REMINDERS
  setReminder() {
    if (!this.medicineName || !this.medicineTime) return;

    this.authService.addReminder({
      medicineName: this.medicineName,
      time: this.medicineTime
    }).subscribe((newReminder: any) => {
      this.reminders.push(newReminder);
      this.medicineName = '';
      this.medicineTime = '';
    });
  }
  deleteReminder(index: number) {
    const reminder = this.reminders[index];

    this.authService.deleteReminder(reminder.id).subscribe(() => {
      this.reminders.splice(index, 1);
    });
  }

  editReminder(index: number) {
    this.reminders[index].editing = true;
  }

  saveReminder(index: number) {
    const reminder = this.reminders[index];

    this.authService.updateReminder(reminder.id, {
      name: reminder.name,
      time: reminder.time
    }).subscribe(() => {
      reminder.editing = false;
    });
  }
  cancelEdit(index: number) {
    this.reminders[index].editing = false;
  }
  addReminder(med: any, time: string) {

    this.authService.addReminder({
      medicineName: med.name,
      time: time
    }).subscribe((newReminder: any) => {

      this.reminders = [
        ...this.reminders,
        {
          id: newReminder.id,
          name: newReminder.name,
          time: newReminder.time,
          editing: false
        }
      ];

    });

  }
  isReminderAdded(med: any, time: string): boolean {

    if (!this.reminders?.length) return false;

    const compareName = this.cleanString(med.name);
    const compareTime = this.cleanTime(time);

    return this.reminders.some(r => {

      const reminderName = this.cleanString(r.name);
      const reminderTime = this.cleanTime(r.time);

      return reminderName === compareName && reminderTime === compareTime;

    });
  }

  cleanString(value: string): string {
    if (!value) return '';

    return value
      .toString()
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' '); // remove extra spaces
  }

  cleanTime(value: string): string {
    if (!value) return '';

    const t = value.toString().trim().toUpperCase();

    if (t === 'PRN') return 'PRN';

    if (t.includes(':')) return t.substring(0, 5);

    return t;
  }
  normalizeTime(time: string): string {
    if (!time) return '';

    const t = time.toString().trim().toUpperCase();

    // Handle PRN
    if (t === 'PRN') return 'PRN';

    // Handle HH:MM:SS
    if (t.includes(':')) {
      return t.substring(0, 5);
    }

    return t;
  }

  addBP() {
    const data = {
      systolic: this.systolic,
      diastolic: this.diastolic,
      pulse: this.pulse
    };

    this.authService.addBloodPressure(data).subscribe(() => {
      this.systolic;
      this.diastolic;
      this.pulse;
      this.loadBP();
    });
  }

  loadBP() {
    this.authService.getBloodPressure().subscribe((data: any) => {
      this.bpRecords = data;
      this.processBPData();
      console.log("All BP:", this.bpRecords);
      console.log("Current Week:", this.currentBP);
    });
  }

  getBPStatus(s: number, d: number): string {

    if (s >= 180 || d > 120) {
      return "Hypertensive Crisis";
    }
    if (s >= 140 || d >= 90) {
      return "Stage 2 Hypertension";
    }
    if (s >= 130 || d >= 80) {
      return "Stage 1 Hypertension";
    }
    if (s >= 120 && d < 80) {
      return "Elevated";
    }
    return "Normal";
  }

  getBPClass(s: number, d: number): string {
    if (s >= 180 || d >= 120) {
      return "crisis";
    }
    if (s >= 140 || d >= 90) {
      return "stage2";
    }
    if (s >= 130 || d >= 80) {
      return "stage1";
    }
    if (s >= 120 && d < 80) {
      return "elevated";
    }
    return "normal";
  }

  applyFilter() {
    if (this.showAll) {
      this.filteredBP = this.bpRecords;
    } else {
      this.filteredBP = this.bpRecords.slice(0, 7); // Last 7 records
    }
  }
  toggleView() {
    this.showAll = !this.showAll;
    this.applyFilter();
  }

  processBPData() {

    if (!this.bpRecords || this.bpRecords.length === 0) {
      this.currentBP = [];
      this.previousBP = [];
      return;
    }

    // First 7 latest records = current week
    this.currentBP = this.bpRecords.slice(0, 7);

    const older = this.bpRecords.slice(7);

    const grouped: any = {};

    older.forEach(bp => {
      const date = new Date(bp.recorded_at);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());

      const key = weekStart.toDateString();

      if (!grouped[key]) {
        grouped[key] = [];
      }

      grouped[key].push(bp);
    });

    this.previousBP = Object.keys(grouped).map(key => ({
      weekStart: key,
      records: grouped[key],
      expanded: false
    }));
  }
  getLatestBP() {
    if (!this.bpRecords || this.bpRecords.length === 0) {
      return null;
    }

    return this.bpRecords[0]; // assuming newest first
  }
  arePrescriptionRemindersAdded(id: number): boolean {

    if (!this.reminders || this.reminders.length === 0) {
      return false;
    }

    return true; // simple version (since we auto-add all)

  }

  togglePrescriptionMedicines(id: number) {

    // If already opened → close it
    if (this.selectedPrescriptionId === id) {
      this.selectedPrescriptionId = null;
      this.medicines = [];
      return;
    }

    // Otherwise load and show
    this.selectedPrescriptionId = id;

    this.authService.analyzePrescription(id).subscribe((res: any) => {
      this.medicines = res.medicines || [];
    });

  }

  addRemindersFromPrescription(id: number) {

    this.analyzedPrescriptionId = id;

    this.authService.analyzePrescription(id).subscribe((res: any) => {

      const meds = res.medicines || [];

      this.medicines = meds; // 🔥 IMPORTANT — store medicines

      meds.forEach((med: any) => {

        med.times.forEach((time: string) => {

          if (!this.isReminderAdded(med, time)) {

            this.authService.addReminder({
              medicineName: med.name,
              time: time
            }).subscribe((newReminder: any) => {

              this.reminders = [
                ...this.reminders,
                {
                  id: newReminder.id,
                  name: newReminder.name,
                  time: newReminder.time,
                  editing: false
                }
              ];

            });

          }

        });

      });

    });

  }

  areAllMedicinesAdded(): boolean {

    if (!this.medicines || this.medicines.length === 0) {
      return false;
    }

    return this.medicines.every(med =>
      med.times.every(time => this.isReminderAdded(med, time))
    );

  }
  // LOGOUT

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}


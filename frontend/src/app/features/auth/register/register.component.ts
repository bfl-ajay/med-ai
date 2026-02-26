import { Component } from '@angular/core';
import { NgForm } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { Router } from '@angular/router';
import { DiseaseService } from '../../../core/services/disease.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent {

  currentStep = 1;

  name = '';
  dob = '';
  mobile_no = '';
  gender = '';
  height: number | null = null;
  weight: number | null = null;
  bloodGroup = '';
  knownDiseases: string[] = [];
  diseaseInput: string = '';
  email = '';
  password = '';
  confirmPassword = '';
  searchDiseases: string[] = [];

  filteredDiseases: string[] = [];
  bloodGroups: string[] = [
    'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'
  ];

  constructor(private authService: AuthService,
    private router: Router,
    private diseaseService: DiseaseService) { }

  nextStep() {
    this.currentStep = 2;
  }

  prevStep() {
    this.currentStep = 1;
  }

  handleSubmit(form: NgForm) {

    if (this.currentStep === 1) {

      if (!this.isStep1Valid()) {
        this.markTouched(form);
        return;
      }

      this.nextStep();
    }

    else {

      if (!this.isStep2Valid()) {
        this.markTouched(form);
        return;
      }

      this.register();
    }
  }

  isStep1Valid(): boolean {
    return (
      this.name?.length >= 3 &&
      !!this.dob &&
      /^[0-9]{10}$/.test(this.mobile_no) &&
      !!this.gender &&
      !!this.height && this.height >= 50 &&
      !!this.weight && this.weight >= 10 &&
      !!this.bloodGroup
    );
  }

  isStep2Valid(): boolean {
    return (
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email) &&
      this.password?.length >= 6 &&
      this.confirmPassword === this.password
    );
  }

  markTouched(form: NgForm) {
    Object.values(form.controls).forEach(control => {
      control.markAsTouched();
    });
  }

  register() {

    const data = {
      name: this.name,
      dob: this.dob,
      mobile_no: this.mobile_no,
      gender: this.gender,
      height: this.height,
      weight: this.weight,
      bloodGroup: this.bloodGroup,
      email: this.email,
      password: this.password
    };

    this.authService.register(data).subscribe({
      next: () => {
        alert('Registration successful!');
        this.router.navigate(['/login']);
      },
      error: () => {
        alert('Registration failed.');
      }
    });
  }
  onDiseaseInput() {
    if (!this.diseaseInput.trim()) {
      this.filteredDiseases = [];
      return;
    }

    console.log("Searching:", this.diseaseInput);

    this.diseaseService.searchDiseases(this.diseaseInput)
      .subscribe(data => {
        console.log("API Response:", data);
        this.filteredDiseases = data.filter(d =>
          !this.knownDiseases.includes(d)
        );
      });
  }

  selectDisease(disease: string) {
    if (!this.knownDiseases.includes(disease)) {
      this.knownDiseases.push(disease);
    }
    this.diseaseInput = '';
    this.filteredDiseases = [];
  }

  addDisease(event: KeyboardEvent) {
    event.preventDefault();
    const value = this.diseaseInput.trim();

    if (!value) return;

    if (!this.knownDiseases.includes(value)) {
      this.knownDiseases.push(value);
    }

    this.diseaseInput = '';
    this.filteredDiseases = [];
  }

  removeDisease(index: number) {
    this.knownDiseases.splice(index, 1);
  }
}
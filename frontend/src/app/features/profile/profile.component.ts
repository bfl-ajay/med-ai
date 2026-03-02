import { Component } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';


@Component({
    selector: 'app-profile',
    templateUrl: './profile.component.html',
    styleUrls: ['./profile.component.css']
})
export class ProfileComponent {

    user: any;
    knownDiseasesText: string = '';

    constructor(private http: HttpClient, private router: Router, private authService: AuthService) { }

    ngOnInit() {
        this.authService.getProfile().subscribe((data: any) => {
            this.user = data;
            if (data.knownDiseases) {
                this.knownDiseasesText = data.knownDiseases.join(', ');
            }
        });
    }

    saveProfile() {

        const updateData = {
            name: this.user?.name,
            email: this.user?.email,
            height: this.user?.height,
            weight: this.user?.weight,
            bloodGroup: this.user?.bloodGroup,
            knownDiseases: this.knownDiseasesText
                ? this.knownDiseasesText.split(',').map(d => d.trim())
                : []
        };

        this.authService.updateProfile(updateData)
            .subscribe(() => {

                // ✅ Fetch fresh profile from backend
                this.authService.getProfile().subscribe((freshProfile: any) => {

                    // ✅ Push new data to navbar
                    this.authService.setUser(freshProfile);

                    // ✅ Navigate after state update
                    this.router.navigate(['/dashboard']);

                });

            });
    }
}
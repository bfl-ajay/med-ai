import { Component } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { Router } from '@angular/router';
import { HostListener } from '@angular/core';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent {

  menuOpen = false;
  profileMenuOpen = false;
  user: any;

  constructor(
    private router: Router,
    private authService: AuthService
  ) { }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const clickedInside = (event.target as HTMLElement)
      .closest('.profile-wrapper');

    if (!clickedInside) {
      this.profileMenuOpen = false;
    }
  }

  ngOnInit() {

    this.authService.user$.subscribe(user => {
      this.user = user;
    });

    // Load once if empty
    if (!this.authService.getCurrentUser()) {
      this.authService.getProfile().subscribe((data: any) => {
        this.authService.setUser(data);
      });
    }
  }

  toggleMenu() {
    this.menuOpen = !this.menuOpen;
  }

  closeMenu() {
    this.menuOpen = false;
  }

  navigateToSection(section: string) {
    this.closeMenu();
    this.router.navigate(['/'], { fragment: section });
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem('token');
  }

  logout() {
    this.authService.logout();
    this.menuOpen = false;
    this.router.navigate(['/login']);
  }

  toggleProfileMenu() {
    if (window.innerWidth < 768) return;
    this.profileMenuOpen = !this.profileMenuOpen;
  }

  goToProfile() {
    this.profileMenuOpen = false;
    this.menuOpen = false;
    this.router.navigate(['/profile']);
  }
}

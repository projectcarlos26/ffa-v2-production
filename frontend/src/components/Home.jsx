import React from 'react';
import { Link } from 'react-router-dom';
import './Home.css';

function Home() {
  return (
    <div className="home">
      <div className="home-container">
        <header className="home-header">
          <h1>Furniture Forensic Analyst v2</h1>
          <p className="tagline">AI-Powered Damage Attribution</p>
        </header>
        
        <div className="home-content">
          <section className="feature-section">
            <h2>What We Do</h2>
            <p>
              Our AI-powered platform analyzes furniture damage to determine whether 
              it originated from manufacturing defects or transit incidents.
            </p>
          </section>
          
          <section className="feature-section">
            <h2>How It Works</h2>
            <ol className="steps-list">
              <li>Select your furniture category</li>
              <li>Upload photos of the damage</li>
              <li>Describe the damage in detail</li>
              <li>Receive a forensic analysis report</li>
            </ol>
          </section>
          
          <section className="feature-section">
            <h2>Supported Categories</h2>
            <div className="categories-grid">
              <div className="category-card">
                <h3>Case Goods</h3>
                <p>Tables, dressers, cabinets, desks</p>
              </div>
              <div className="category-card">
                <h3>Upholstery</h3>
                <p>Sofas, chairs, sectionals, ottomans</p>
              </div>
              <div className="category-card">
                <h3>Bed Frames</h3>
                <p>Platform beds, metal frames, bunk beds</p>
              </div>
            </div>
          </section>
          
          <section className="cta-section">
            <Link to="/submit" className="btn btn-primary btn-large">
              Submit New Case
            </Link>
          </section>
        </div>
        
        <footer className="home-footer">
          <p>&copy; 2024 Furniture Forensic Analyst v2 - MVP</p>
        </footer>
      </div>
    </div>
  );
}

export default Home;
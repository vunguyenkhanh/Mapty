'use strict';

const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const resetBtn = document.querySelector('.reset-btn');

class Workout {
  date = new Date();
  id = Date.now() + ''.slice(-10);
  clicks = 0;

  constructor(coords, distance, duration) {
    // this.date =
    // this.id =
    this.coords = coords; // [lat,lng]
    this.distance = distance; // in km
    this.duration = duration; // in min
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }

  click() {
    this.clicks++;
  }
}

class Running extends Workout {
  type = 'running';

  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }
  calcPace() {
    // min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';

  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    // this.type = 'cycling';
    this.calcSpeed();
    this._setDescription();
  }
  calcSpeed() {
    // km/h
    this.speed = this.duration / (this.distance / 60);
    return this.speed;
  }
}

class App {
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  #workouts = [];
  #editingWorkout = null;
  #markers = new Map(); // Add this to track markers

  constructor() {
    // Get user's position
    this._getPosition();

    // Get data from local storage
    this._getLocalStorage();

    // Attach event handlers
    form.addEventListener('submit', this._newWorkout.bind(this));
    inputType.addEventListener('change', this._toggleElevationForm);
    containerWorkouts.addEventListener(
      'click',
      this._handleWorkoutClick.bind(this)
    );
    resetBtn.addEventListener('click', this.reset.bind(this)); // Change this line
  }

  _getPosition() {
    if (navigator.geolocation)
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert('Cound not get your position');
        }
      );
  }

  _loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;

    const coords = [latitude, longitude];

    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);

    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    // Handling click on map
    this.#map.on('click', this._showForm.bind(this));

    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
    });
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _hideForm() {
    // Empty inputs
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        '';

    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => {
      form.style.display = 'grid';
    }, 1000);
  }

  _toggleElevationForm() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _createWorkout(type, coords, distance, duration, extra) {
    try {
      if (type === 'running') {
        this._validateInputs(distance, duration, extra);
        return new Running(coords, distance, duration, extra);
      }
      if (type === 'cycling') {
        this._validateInputs(distance, duration, extra);
        return new Cycling(coords, distance, duration, extra);
      }
      throw new Error('Invalid workout type');
    } catch (err) {
      alert(err.message);
      return null;
    }
  }

  _updateMarkers(workout, oldWorkout = null) {
    // Remove old marker if updating
    if (oldWorkout) {
      const oldMarker = this.#markers.get(oldWorkout.id);
      if (oldMarker) {
        oldMarker.remove();
        this.#markers.delete(oldWorkout.id);
      }
    }

    // Add new marker
    const marker = L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃' : '🚴‍♀️'} ${workout.description}`
      )
      .openPopup();

    this.#markers.set(workout.id, marker);
  }

  _newWorkout(e) {
    e.preventDefault();
    if (this.#editingWorkout) {
      this._updateWorkout(e);
      return;
    }

    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const extra =
      type === 'running' ? +inputCadence.value : +inputElevation.value;
    const { lat, lng } = this.#mapEvent.latlng;

    const workout = this._createWorkout(
      type,
      [lat, lng],
      distance,
      duration,
      extra
    );
    if (!workout) return;

    this.#workouts.push(workout);
    this._updateMarkers(workout);
    this._renderWorkout(workout);
    this._hideForm();
    this._setLocalStorage();
  }

  _updateWorkout(e) {
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const extra =
      type === 'running' ? +inputCadence.value : +inputElevation.value;
    const oldWorkout = this.#editingWorkout;

    const workout = this._createWorkout(
      type,
      oldWorkout.coords,
      distance,
      duration,
      extra
    );
    if (!workout) return;

    workout.id = oldWorkout.id;
    workout.date = oldWorkout.date;

    const index = this.#workouts.findIndex(w => w.id === workout.id);
    this.#workouts[index] = workout;

    this._updateMarkers(workout, oldWorkout);
    this._updateWorkoutUI(workout);
    this._hideForm();
    this.#editingWorkout = null;
    this._setLocalStorage();
  }

  _updateWorkoutUI(workout) {
    const workoutEl = document.querySelector(`[data-id="${workout.id}"]`);
    if (workoutEl) workoutEl.remove();
    this._renderWorkout(workout);
  }

  _validateInputs(...inputs) {
    const isValid = inputs.every(inp => Number.isFinite(inp) && inp > 0);
    if (!isValid) throw new Error('Inputs must be positive numbers');
    return true;
  }

  _handleWorkoutClick(e) {
    const workoutEl = e.target.closest('.workout');
    if (!workoutEl) return;

    if (e.target.classList.contains('workout__edit')) {
      this._editWorkout(workoutEl);
      return;
    }

    if (e.target.classList.contains('workout__delete')) {
      this._deleteWorkout(workoutEl);
      return;
    }

    // Handle moving to popup
    this._moveToPopup(e);
  }

  _deleteWorkout(workoutEl) {
    const workoutId = workoutEl.dataset.id;

    // Remove from workouts array
    this.#workouts = this.#workouts.filter(w => w.id !== workoutId);

    // Remove marker from map
    const marker = this.#markers.get(workoutId);
    if (marker) {
      marker.remove();
      this.#markers.delete(workoutId);
    }

    // Remove from UI
    workoutEl.remove();

    // Update localStorage
    this._setLocalStorage();
  }

  _editWorkout(workoutEl) {
    const workout = this.#workouts.find(w => w.id === workoutEl.dataset.id);
    this.#editingWorkout = workout;

    // Show form with current values
    form.classList.remove('hidden');
    workoutEl.classList.add('workout--editing');

    inputType.value = workout.type;
    inputDistance.value = workout.distance;
    inputDuration.value = workout.duration;

    if (workout.type === 'running') {
      inputElevation.closest('.form__row').classList.add('form__row--hidden');
      inputCadence.closest('.form__row').classList.remove('form__row--hidden');
      inputCadence.value = workout.cadence;
    }
    if (workout.type === 'cycling') {
      inputCadence.closest('.form__row').classList.add('form__row--hidden');
      inputElevation
        .closest('.form__row')
        .classList.remove('form__row--hidden');
      inputElevation.value = workout.elevationGain;
    }
  }

  _renderWorkoutMarker(workout) {
    const marker = L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃' : '🚴‍♀️'} ${workout.description}`
      )
      .openPopup();

    // Store marker reference in markers Map
    this.#markers.set(workout.id, marker);
  }

  _renderWorkout(workout) {
    let html = `
        <li class="workout workout--${workout.type}" data-id="${workout.id}">
          <h2 class="workout__title">
            ${workout.description}
            <div class="workout__controls">
              <button class="workout__edit" title="Edit">✏️</button>
              <button class="workout__delete" title="Delete">🗑️</button>
            </div>
          </h2>
          <div class="workout__details">
            <span class="workout__icon">${
              workout.type === 'running' ? '🏃' : '🚴‍♀️'
            }</span>
            <span class="workout__value">${workout.distance}</span>
            <span class="workout__unit">km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">⏱</span>
            <span class="workout__value">${workout.duration}</span>
            <span class="workout__unit">min</span>
          </div>`;

    if (workout.type === 'running') {
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.pace.toFixed(1)}</span>
          <span class="workout__unit">min/km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">🦶🏼</span>
          <span class="workout__value">${workout.cadence}</span>
          <span class="workout__unit">spm</span>
        </div>
        </li>`;
    }

    if (workout.type === 'cycling') {
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.speed.toFixed(1)}</span>
          <span class="workout__unit">km/h</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⛰</span>
          <span class="workout__value">${workout.elevationGain}</span>
          <span class="workout__unit">m</span>
        </div>
        </li>`;
    }
    form.insertAdjacentHTML('afterend', html);
  }

  _moveToPopup(e) {
    const workoutEl = e.target.closest('.workout');

    if (!workoutEl) return;

    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );
    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });

    // Using the public interface
    // workout.click();
  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));

    if (!data) return;

    // Restore prototype chain for each workout
    this.#workouts = data.map(work => {
      let workout;
      if (work.type === 'running') {
        workout = new Running(
          work.coords,
          work.distance,
          work.duration,
          work.cadence
        );
      }
      if (work.type === 'cycling') {
        workout = new Cycling(
          work.coords,
          work.distance,
          work.duration,
          work.elevationGain
        );
      }
      workout.id = work.id;
      workout.date = new Date(work.date);
      return workout;
    });

    this.#workouts.forEach(work => {
      this._renderWorkout(work);
    });
  }

  reset = () => {
    // Change to arrow function
    localStorage.removeItem('workouts');
    this.#markers.forEach(marker => marker.remove());
    this.#markers.clear();
    this.#workouts = [];
    location.reload();
  };
}

const app = new App();

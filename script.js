const viewer = document.getElementById('model-viewer');
      
      const weaponBtn = document.querySelector('.Weapon');
      const shieldBtn = document.querySelector('.Shield');

      weaponBtn.addEventListener('click', () => {
        viewer.setAttribute('src', './src/Battle Axe.glb');
      });

      shieldBtn.addEventListener('click', () => {
        viewer.setAttribute('src', './src/Shield.glb'); 
      });
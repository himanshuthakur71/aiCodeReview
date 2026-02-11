<script>
  // ❌ ISSUE 1: Using old reactive syntax instead of $state
  let userName = "John Doe";
  let userAge = 25;
  
  // ❌ ISSUE 2: Using $: instead of $derived
  $: displayName = userName.toUpperCase();
  $: isAdult = userAge >= 18;
  
  // ❌ ISSUE 3: Missing error handling in fetch
  async function loadUserData() {
    const response = await fetch('/api/user');
    const data = await response.json();
    userName = data.name;
  }
  
  // ❌ ISSUE 4: Using console.log in production
  function handleClick() {
    console.log('User clicked:', userName);
    userAge++;
  }
  
  // ❌ ISSUE 5: Unescaped HTML (XSS vulnerability)
  let userBio = "<script>alert('xss')</script>";
</script>

<!-- ❌ ISSUE 6: Using div with onclick instead of button -->
<div class="profile" onclick={handleClick}>
  <!-- ❌ ISSUE 7: Image without alt text -->
  <img src="/avatar.jpg" />
  
  <h2>{displayName}</h2>
  <p>Age: {userAge}</p>
  
  <!-- ❌ ISSUE 8: Unescaped HTML rendering -->
  <div class="bio">{@html userBio}</div>
  
  <!-- ❌ ISSUE 9: Poor color contrast -->
  <p style="color: #ccc; background: #ddd;">
    {isAdult ? 'Adult' : 'Minor'}
  </p>
</div>

<style>
  .profile {
    padding: 20px;
    /* ❌ ISSUE 10: Using cursor pointer on non-interactive div */
    cursor: pointer;
  }
</style>
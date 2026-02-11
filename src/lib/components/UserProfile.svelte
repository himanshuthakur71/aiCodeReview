<!-- This component has INTENTIONAL issues for the demo -->
<script>
  //  Issue 1: Not using Svelte 5 runes
  let userName = '';
  let userAge = 0;
  let isLoading = false;
  
  //  Issue 2: No error handling in fetch
  function loadUserData() {
    isLoading = true;
    fetch('/api/users/' + userId).then(response => {
      return response.json();
    }).then(data => {
      userName = data.name;
      userAge = data.age;
      isLoading = false;
    });
  }
  
  //  Issue 3: console.log in production code
  console.log('UserProfile component loaded');
  
  //  Issue 4: Using old reactive syntax
  $: displayName = userName.toUpperCase();
</script>

<!--  Issue 5: div used instead of button -->
<div class="profile-card">
  <h2>User Profile</h2>
  
  <!--  Issue 6: Image without alt text -->
  <img src="/avatar.png" class="avatar" />
  
  {#if isLoading}
    <p>Loading...</p>
  {:else}
    <div class="user-info">
      <p style="color: #999; font-size: 12px;">{displayName}</p>
      <p>Age: {userAge}</p>
    </div>
  {/if}
  
  <!--  Issue 7: Using div with onclick instead of button -->
  <div onclick={() => loadUserData(123)} class="load-button">
    Load User Data
  </div>
</div>

<style>
  .profile-card {
    padding: 20px;
    border: 1px solid #ddd;
    border-radius: 8px;
  }
  
  .avatar {
    width: 100px;
    height: 100px;
    border-radius: 50%;
  }
  
  /* Issue 8: Poor color contrast */
  .user-info p {
    color: #ccc;
    background: white;
  }
  
  .load-button {
    cursor: pointer;
    padding: 10px;
    background: blue;
    color: white;
    text-align: center;
    margin-top: 10px;
  }
</style>
namespace :admin do
  desc "Create or update super_admin user. Usage: rake admin:create EMAIL=... PASSWORD=... NAME=..."
  task create: :environment do
    email    = ENV.fetch("EMAIL")    { abort "EMAIL is required. Usage: rake admin:create EMAIL=... PASSWORD=... NAME=..." }
    password = ENV.fetch("PASSWORD") { abort "PASSWORD is required." }
    name     = ENV.fetch("NAME", "Super Admin")

    user = User.find_or_initialize_by(provider: "local", provider_uid: email.downcase.strip)
    user.assign_attributes(
      role:     "super_admin",
      name:     name,
      email:    email.downcase.strip,
      password: password
    )
    if user.save
      action = user.previously_new_record? ? "created" : "updated"
      puts "Super admin #{action}: #{email}"
    else
      puts "Failed: #{user.errors.full_messages.join(', ')}"
      exit 1
    end
  end
end

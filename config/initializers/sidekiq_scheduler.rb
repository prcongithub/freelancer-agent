Sidekiq.configure_server do |config|
  config.on(:startup) do
    Sidekiq::Cron::Job.load_from_hash(
      "Scanner - every 10 minutes" => {
        "cron"  => "*/10 * * * *",
        "class" => "Scanner::ScanJob"
      },
      "Auto Bidder - every 15 minutes" => {
        "cron"  => "*/15 * * * *",
        "class" => "Tracker::AutoBidJob"
      },
      "Status Sync - every 30 minutes" => {
        "cron"  => "*/30 * * * *",
        "class" => "Tracker::SyncStatusJob"
      }
    )
  end
end

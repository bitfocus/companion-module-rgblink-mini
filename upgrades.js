module.exports = [
	/*
	 * Place your upgrade scripts here
	 * Remember that once it has been added it cannot be removed!
	 */
	// function (context, props) {
	// 	return {
	// 		updatedConfig: null,
	// 		updatedActions: [],
	// 		updatedFeedbacks: [],
	// 	}
	// },
	function (context, props) {
		// add default port #

		const result = {
			updatedConfig: null,
			updatedActions: [],
			updatedFeedbacks: [],
		}

		if (props.config) {
			if (props.config.port == undefined) {
				props.config.port = 1000
				result.updatedConfig = props.config
			}
      if (props.config.logEveryCommand == undefined) {
        props.config.logEveryCommnand = false
				result.updatedConfig = props.config
      }
		}

		return result
	},
]
